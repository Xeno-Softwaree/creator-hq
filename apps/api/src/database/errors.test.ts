import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {PrismaClient,Prisma} from '../../generated/postgresql/index.js';
import {databaseErrorCode,isDatabaseUnavailable} from './errors.js';
import {isolateApiTestEnvironment} from './test-environment.js';
isolateApiTestEnvironment('file:./unused-error-test.db');

test('only known connection errors are classified, including actual Prisma initialization errors',()=>{
 for(const code of ['P1000','P1001','P1002','P1008','P1011','P1017','P2024']){
  assert.equal(isDatabaseUnavailable(new Prisma.PrismaClientInitializationError('private fixture','6.19.3',code)),true);
  assert.equal(isDatabaseUnavailable({code}),true);
 }
 for(const error of [new TypeError('private fixture'),{code:'P2002'},{code:'P2003'},{code:'P2010',meta:{code:'23503'}},{errorCode:'P1001'},new Prisma.PrismaClientInitializationError('private fixture','6.19.3','P1012')])assert.equal(isDatabaseUnavailable(error),false);
 assert.equal(databaseErrorCode({code:'private-secret-value'}),undefined);
});

test('API failures are sanitized and distinguish unavailability from bugs and integrity errors',async()=>{
 const {buildApp}=await import('../app.js');
 const {db}=await import('../db.js');
 let failure:unknown=new Prisma.PrismaClientInitializationError('private-secret-value','6.19.3','P1001');
 const fail=async()=>{throw failure};
 const fake={$queryRaw:fail,agent:{findMany:fail,findUnique:fail},$transaction:async(operation:(tx:unknown)=>Promise<unknown>)=>operation({agent:{findUnique:fail}}),$disconnect:async()=>{}};
 const app=await buildApp({database:fake as unknown as typeof db,provider:'postgresql'});
 try{
  for(const error of [failure,new TypeError('private-secret-value'),{code:'P2002',message:'private-secret-value'},{code:'P2003'},{code:'P2010',meta:{message:'private-secret-value',code:'23503'}}]){
   failure=error;const expected=isDatabaseUnavailable(error)?503:500;
   for(const request of [{method:'GET',url:'/state'},{method:'POST',url:'/tasks',payload:{title:'fixture',studio:'Niko',agentId:'fixture'}}] as const){
    const r:{statusCode:number;body:string;json:()=>{code?:string}}=await app.inject(request);assert.equal(r.statusCode,expected);assert.equal(r.json().code,expected===503?'DATABASE_UNAVAILABLE':'INTERNAL_ERROR');assert.ok(!r.body.includes('private-secret-value'));
   }
   const health=await app.inject({method:'GET',url:'/health'});assert.equal(health.statusCode,expected);
  }
 }finally{await app.close()}
});

test('real Prisma outage, reconnect and normal writes never replay failed requests', {timeout:60000},async()=>{
 const {buildApp}=await import('../app.js');const {db}=await import('../db.js');
 const engine=new PGlite();let server=new PGLiteSocketServer({db:engine,host:'127.0.0.1',port:0,maxConnections:1,inspect:false,debug:false});let client:PrismaClient|undefined;let app:Awaited<ReturnType<typeof buildApp>>|undefined;
 try{
  await engine.exec('CREATE ROLE creator_hq_runtime NOINHERIT');await engine.exec(readFileSync('prisma/postgresql/migrations/20261106000100_phase12_initial/migration.sql','utf8'));
  await engine.query('INSERT INTO creator_hq."Agent" (id,name,role,studio) VALUES ($1,$2,$3,$4)',['fixture','Test agent','Test','Niko']);
  await server.start();const url=new URL('postgresql://'+server.getServerConn()+'/postgres');const port=Number(url.port);url.username='postgres';url.password='isolated-fixture';
  for(const [k,v] of Object.entries({schema:'creator_hq',sslmode:'disable',connection_limit:'1',connect_timeout:'1',pool_timeout:'1',socket_timeout:'2'}))url.searchParams.set(k,v);
  await server.stop();
  client=new PrismaClient({datasources:{db:{url:url.toString()}},log:[],errorFormat:'minimal'});
  app=await buildApp({database:client as unknown as typeof db,provider:'postgresql'});
  for(const request of [{method:'GET',url:'/health'},{method:'GET',url:'/state'},{method:'POST',url:'/tasks',payload:{title:'FAILED REQUEST MUST NOT REPLAY',studio:'Niko',agentId:'fixture'}}] as const){const r:{statusCode:number;body:string;json:()=>{code?:string}}=await app.inject(request);assert.equal(r.statusCode,503);assert.equal(r.json().code,'DATABASE_UNAVAILABLE')}
  server=new PGLiteSocketServer({db:engine,host:'127.0.0.1',port,maxConnections:1,inspect:false,debug:false});await server.start();
  const health=await app.inject({method:'GET',url:'/health'});assert.equal(health.statusCode,200);assert.equal(health.json().database,'postgresql');
  const state=await app.inject({method:'GET',url:'/state'});assert.equal(state.statusCode,200);assert.equal(state.json().agents.length,1);assert.equal(state.json().tasks.length,0);assert.equal(await client.task.count(),0);
  const created=await app.inject({method:'POST',url:'/tasks',payload:{title:'SUCCESSFUL REQUEST',studio:'Niko',agentId:'fixture'}});assert.equal(created.statusCode,201);assert.equal(await client.task.count(),1);
  assert.equal((await app.inject({method:'DELETE',url:'/tasks/'+created.json().id})).statusCode,204);assert.equal(await client.task.count(),0);
 }finally{await app?.close();await client?.$disconnect();await server.stop();await engine.close()}
});
