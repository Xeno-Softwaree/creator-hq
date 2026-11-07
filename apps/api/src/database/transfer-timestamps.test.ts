import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {PrismaClient,prismaTarget} from './target.js';
import {normalizeTimestamp,makeSnapshot,type TableName,type Row} from './snapshot.js';
import {transferSnapshot,destinationSnapshot,type SqlTarget} from './transfer.js';

// Fake records only. No dotenv, workspace database or private configuration is read.
function fixture(){
 const tables:Record<TableName,Row[]>={Agent:[],Task:[],Activity:[],Approval:[],StudioSettings:[],AgentReport:[]};
 tables.Agent=[{id:'0001',name:"Fixture '; DROP TABLE creator_hq.\"Agent\"; --",role:'Test',studio:'Niko',instructions:'Original çğışü 🔐',enabled:false}];
 tables.Task=[{id:'task',title:'Original title',description:'Text with $1 and quotes',studio:'Niko',status:'Review',agentId:'0001',createdAt:'2024-02-29T23:30:00.123-03:00',updatedAt:'2024-03-01T06:00:00.987+03:00'}];
 tables.Activity=[{id:'activity',agentId:'0001',message:'Original event',simulated:false,createdAt:'2024-03-01T02:30:00.001Z'}];
 tables.Approval=[{id:'approval',title:'Original approval',agentId:'0001',status:'Approved',simulated:true,createdAt:'2024-03-01T02:30:00.002Z'}];
 tables.StudioSettings=[{id:'Niko',contentLanguage:'en-US'}];
 tables.AgentReport=[{id:'report',sourceId:'activity',agentId:'0001',taskId:'task',approvalId:'approval',source:'simulation',status:'completed',summaryData:'{"text":"kept as text"}',originalTechnicalReport:'Original report',createdAt:'2024-03-01T02:30:00.003Z'},
 {id:'nullable-report',sourceId:'other',agentId:'0001',taskId:null,approvalId:null,source:'manual',status:'completed',summaryData:'{}',originalTechnicalReport:'Null links retained',createdAt:'1970-01-01T00:00:00.000Z'}];
 return makeSnapshot(tables);
}

test('timestamp validation preserves explicit instants and rejects ambiguity, invalid dates and precision loss',()=>{
 assert.equal(normalizeTimestamp(0),'1970-01-01T00:00:00.000Z');
 assert.equal(normalizeTimestamp('2024-02-29T23:30:00.123-03:00'),'2024-03-01T02:30:00.123Z');
 assert.equal(normalizeTimestamp('2024-03-01T06:00:00.987+03:00'),'2024-03-01T03:00:00.987Z');
 assert.equal(normalizeTimestamp('2000-02-29T00:00:00Z'),'2000-02-29T00:00:00.000Z');
 const date=new Date('2024-03-01T02:30:00.123Z');assert.equal(normalizeTimestamp(date),date.toISOString());assert.equal(date.getTime(),1709260200123);
 for(const value of [null,undefined,true,false,'',' ',1.5,NaN,Infinity,new Date(NaN),'2024-03-01','2024-03-01T02:30:00','2023-02-29T00:00:00Z','2024-02-30T00:00:00Z','2024-13-01T00:00:00Z','2024-01-00T00:00:00Z','2024-01-01T24:00:00Z','2024-01-01T00:00:60Z','2024-01-01T00:00:00+24:00','2024-01-01T00:00:00+03:60','0000-01-01T00:00:00Z']){
  assert.throws(()=>normalizeTimestamp(value),/^Error: INVALID_TIMESTAMP$/);
 }
 assert.throws(()=>normalizeTimestamp('2024-03-01T02:30:00.123456Z'),/TIMESTAMP_PRECISION_UNSUPPORTED/);
});

test('invalid dates and other field types fail before any destination transaction',async()=>{
 let called=false;
 const target:SqlTarget={query:async()=>{called=true;return []},transaction:async()=>{called=true;throw new Error('UNEXPECTED_TRANSACTION')}};
 for(const [table,field,value] of [
  ['Task','createdAt',''],['Task','updatedAt','2024-02-30T00:00:00Z'],['Activity','createdAt',null],['Approval','createdAt','missing'],['AgentReport','createdAt','2024-03-01T00:00:00.1234Z'],
  ['Agent','enabled','false'],['Activity','simulated','true'],['Approval','simulated',2],['Task','title',42],['AgentReport','taskId',false]
 ] as const){
  const source=fixture();(source.tables[table][0] as Record<string,unknown>)[field]=value;
  await assert.rejects(()=>transferSnapshot(source,target,true),/INVALID_TIMESTAMP|TIMESTAMP_PRECISION_UNSUPPORTED|INVALID_BOOLEAN|INVALID_FIELD_TYPE/);
 }
 assert.equal(called,false);
});

test('actual Prisma wire binding preserves timestamps, nulls and booleans with replay and rollback', {timeout:60000},async()=>{
 const engine=new PGlite();
 const server=new PGLiteSocketServer({db:engine,host:'127.0.0.1',port:0,maxConnections:1,inspect:false,debug:false});
 let client:PrismaClient|undefined;
 try{
  await engine.exec('CREATE ROLE creator_hq_runtime NOINHERIT;');
  await engine.exec(readFileSync('prisma/postgresql/migrations/20261106000100_phase12_initial/migration.sql','utf8'));
  await server.start();
  const url=new URL('postgresql://'+server.getServerConn()+'/postgres');url.username='postgres';url.password='isolated-fixture';
  // No TLS only on this in-memory loopback fixture; production TLS policy is untouched.
  for(const [key,value] of Object.entries({schema:'creator_hq',sslmode:'disable',connection_limit:'1',connect_timeout:'3',pool_timeout:'3',socket_timeout:'10'}))url.searchParams.set(key,value);
  client=new PrismaClient({datasources:{db:{url:url.toString()}},log:[],errorFormat:'minimal'});
  const target=prismaTarget(client),source=fixture();
  // Demonstrate that the real Prisma protocol reproduces the old text binding defect.
  await assert.rejects(()=>client!.$executeRawUnsafe('INSERT INTO creator_hq."Activity" (id,"agentId",message,simulated,"createdAt") VALUES ($1,$2,$3,$4,$5)','old','missing','fake',false,'2024-03-01T00:00:00.123Z'),
   (error:unknown)=>{const e=error as {code?:string;meta?:{code?:string}};return e.code==='P2010'&&e.meta?.code==='42804'});
  const empty=await destinationSnapshot(target);
  const forcedRollback:SqlTarget={...target,transaction:op=>target.transaction(async tx=>{await op(tx);throw new Error('FIXTURE_ROLLBACK')})};
  await assert.rejects(()=>transferSnapshot(source,forcedRollback,true),/FIXTURE_ROLLBACK/);
  assert.equal((await destinationSnapshot(target)).fingerprint,empty.fingerprint);
  // Fail after Agent, Task and Activity inserts to prove rollback on a late FK error.
  const lateFailure:SqlTarget={...target,transaction:op=>target.transaction(tx=>op({...tx,query:async(sql,parameters=[])=>{
   if(sql.startsWith('INSERT INTO creator_hq."Approval"')){const values=[...parameters];values[2]='missing-agent';return tx.query(sql,values)}
   return tx.query(sql,parameters);
  }}))};
  await assert.rejects(()=>transferSnapshot(source,lateFailure,true),(error:unknown)=>(error as {meta?:{code?:string}}).meta?.code==='23503');
  assert.equal((await destinationSnapshot(target)).fingerprint,empty.fingerprint);
  await client.$executeRawUnsafe("SET TIME ZONE 'Pacific/Auckland'");
  const first=await transferSnapshot(source,target,true);assert.equal(first.verified,true);
  assert.equal((await destinationSnapshot(target)).fingerprint,source.fingerprint);
  const second=await transferSnapshot(source,target,true);assert.deepEqual(second.destinationCounts,first.destinationCounts);assert.equal(second.allFieldsMatch,true);
  const task=await client.task.findUniqueOrThrow({where:{id:'task'}});
  assert.equal(task.createdAt.toISOString(),'2024-03-01T02:30:00.123Z');assert.equal(task.updatedAt.toISOString(),'2024-03-01T03:00:00.987Z');
  assert.equal((await client.agent.findUniqueOrThrow({where:{id:'0001'}})).enabled,false);
  assert.equal((await client.activity.findUniqueOrThrow({where:{id:'activity'}})).simulated,false);
  assert.equal((await client.approval.findUniqueOrThrow({where:{id:'approval'}})).simulated,true);
  assert.equal((await client.agentReport.findUniqueOrThrow({where:{id:'nullable-report'}})).taskId,null);
  assert.equal(await client.studio.count(),3);
 }finally{await client?.$disconnect();await server.stop();await engine.close()}
});
