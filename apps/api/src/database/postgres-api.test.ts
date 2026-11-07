import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {PrismaClient} from '../../generated/postgresql/index.js';
import {prismaTarget} from './target.js';
import {inspectPostgresSecurity} from './preflight.js';
import {isolateApiTestEnvironment} from './test-environment.js';
isolateApiTestEnvironment('file:./unused-isolated-default.db');
test('generated Prisma PostgreSQL client and API work over isolated loopback TCP', {timeout:30000},async()=>{
 const engine=new PGlite();const server=new PGLiteSocketServer({db:engine,host:'127.0.0.1',port:0,maxConnections:1,inspect:false,debug:false});
 let client:PrismaClient|undefined;
 try{
  await engine.exec('CREATE ROLE creator_hq_runtime NOINHERIT; CREATE ROLE anon; CREATE ROLE authenticated;');await engine.exec(readFileSync('prisma/postgresql/migrations/20261106000100_phase12_initial/migration.sql','utf8'));
  await server.start();
  const url=new URL('postgresql://'+server.getServerConn()+'/postgres');url.username='postgres';url.password='test-only';for(const [key,value] of Object.entries({schema:'creator_hq',sslmode:'disable',connection_limit:'1',connect_timeout:'3',pool_timeout:'3',socket_timeout:'10'}))url.searchParams.set(key,value);
  client=new PrismaClient({datasources:{db:{url:url.toString()}},errorFormat:'minimal',log:[]});
  await client.agent.createMany({data:Array.from({length:9},(_,i)=>({id:'agent-'+i,name:'Agent '+i,role:'Test role',studio:'Niko'}))});
  await client.studioSettings.createMany({data:[{id:'Niko',contentLanguage:'en-US'},{id:'Son Yedek',contentLanguage:'tr-TR'}]});
  const security=await inspectPostgresSecurity(prismaTarget(client));assert.equal(security.publicSchemaAccess,false);
  const {buildApp}=await import('../app.js');const {db}=await import('../db.js');
  const app=await buildApp({database:client as unknown as typeof db,provider:'postgresql'});
  try{
   const health=await app.inject({method:'GET',url:'/health'});assert.equal(health.statusCode,200);assert.equal(health.json().database,'postgresql');
   assert.equal((await app.inject({method:'GET',url:'/state'})).json().agents.length,9);
   const created=await app.inject({method:'POST',url:'/tasks',payload:{title:'Isolated PostgreSQL task',description:'Keep original text',studio:'Niko',agentId:'agent-1'}});assert.equal(created.statusCode,201);const id=created.json().id;
   assert.equal((await app.inject({method:'PATCH',url:'/tasks/'+id,payload:{status:'Done'}})).statusCode,200);
   assert.equal((await client.task.findUniqueOrThrow({where:{id}})).description,'Keep original text');assert.equal(await client.agentReport.count({where:{taskId:id}}),1);
   await client.$disconnect();await client.$connect();assert.equal((await client.task.findUniqueOrThrow({where:{id}})).status,'Done');
   const simulated=(await app.inject({method:'POST',url:'/simulate'})).json();assert.equal(simulated.simulated,true);
   assert.equal((await app.inject({method:'PATCH',url:'/approvals/'+simulated.id,payload:{status:'Approved'}})).json().execution,'disabled');
   assert.equal((await app.inject({method:'DELETE',url:'/tasks/'+id})).statusCode,204);
   const report=await client.agentReport.findFirstOrThrow({where:{source:'manual'}});assert.equal(report.taskId,null);assert.ok(report.originalTechnicalReport.includes(id));
   const state=(await app.inject({method:'GET',url:'/state'})).json();assert.ok(state.activity.length>0);assert.ok(state.reports.length>0);assert.equal(state.studioSettings.find((item:{id:string})=>item.id==='Niko').contentLanguage,'en-US');
  }finally{await app.close()}
 }finally{
  await client?.$disconnect();await server.stop();await engine.close();
 }
});
