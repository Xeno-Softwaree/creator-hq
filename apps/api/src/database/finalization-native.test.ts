import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,unlinkSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {PrismaClient} from '../../generated/postgresql/index.js';
import {isolateApiTestEnvironment} from './test-environment.js';
import {verifyPostgresStartup} from './startup.js';
const bin=process.env.CREATOR_TEST_POSTGRES_BIN;
isolateApiTestEnvironment('file:./unused-native-fixture.db');

// Explicit native test tools only. No private .env, remote host, service or production data.
test('native PostgreSQL finalization: atomic writes, concurrent Done, rollback and restart', {skip:!bin,timeout:120000},async t=>{
 const {buildApp}=await import('../app.js');const {db}=await import('../db.js');
 const directory=mkdtempSync(join(tmpdir(),'creator-hq-pg13-')),cluster=join(directory,'cluster');
 const executable=(name:string)=>join(bin!,name+(process.platform==='win32'?'.exe':''));
 const run=(name:string,args:string[],options:Record<string,unknown>={})=>{try{return execFileSync(executable(name),args,{stdio:name==='pg_ctl'?'ignore':'pipe',encoding:'utf8',windowsHide:true,timeout:30000,...options})}catch(error){
  const e=error as {code?:string;stderr?:Buffer|string};const text=String(e.stderr??'');
  const category=e.code==='ETIMEDOUT'?'TIMEOUT':/password authentication failed/i.test(text)?'AUTHENTICATION':/no password supplied/i.test(text)?'PASSWORD_MISSING':/Connection refused|could not connect/i.test(text)?'CONNECTION':/syntax error/i.test(text)?'SQL_SYNTAX':/already exists/i.test(text)?'ALREADY_EXISTS':/permission denied|access is denied/i.test(text)?'PERMISSIONS':'TOOL_ERROR';
  throw new Error('ISOLATED_NATIVE_'+name.toUpperCase()+'_'+category);
 }};
 let client:PrismaClient|undefined,app:Awaited<ReturnType<typeof buildApp>>|undefined,started=false;
 try{
  if(process.platform==='win32'){
   const account=execFileSync('whoami',['/user','/fo','csv','/nh'],{encoding:'utf8'}).match(/S-1-5-[0-9-]+/)?.[0];assert.ok(account);
   execFileSync('icacls',[directory,'/inheritance:r','/grant:r','*'+account+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F'],{stdio:'pipe'});
  }
  const password=randomBytes(32).toString('hex'),pw=join(directory,'bootstrap-secret');writeFileSync(pw,password,{mode:0o600});
  try{run('initdb',['-D',cluster,'-U','postgres','--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C','--pwfile',pw])}finally{unlinkSync(pw)}
  const port=await new Promise<number>((resolvePort,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=(s.address() as {port:number}).port;s.close(e=>e?reject(e):resolvePort(p))})});assert.notEqual(port,5432);
  try{run('pg_ctl',['-D',cluster,'-l',join(directory,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -c log_statement=none -c log_min_error_statement=panic`,'-w','start'])}finally{started=existsSync(join(cluster,'postmaster.pid'))}
  const environment={SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,PGHOST:'127.0.0.1',PGPORT:String(port),PGDATABASE:'postgres',PGUSER:'postgres',PGPASSWORD:password,PGSSLMODE:'disable'};
  const runtimePassword=randomBytes(32).toString('hex');
  run('psql',['-X','-v','ON_ERROR_STOP=1','-f','-'],{env:environment,input:`CREATE ROLE creator_hq_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION PASSWORD '${runtimePassword}'; CREATE SCHEMA creator_hq; CREATE TABLE creator_hq._prisma_migrations(id text);`});
  run('psql',['-X','-v','ON_ERROR_STOP=1','-f',fileURLToPath(new URL('../../prisma/postgresql/migrations/20261106000100_phase12_initial/migration.sql',import.meta.url))],{env:environment});
  run('psql',['-X','-v','ON_ERROR_STOP=1','-c',`INSERT INTO creator_hq."Agent" (id,name,role,studio) VALUES ('fixture','Test','Test','Niko')`],{env:environment});
  const url=new URL('postgresql://127.0.0.1:'+port+'/postgres');url.username='creator_hq_runtime';url.password=runtimePassword;
  for(const [k,v] of Object.entries({schema:'creator_hq',sslmode:'disable',connection_limit:'5',connect_timeout:'2',pool_timeout:'2',socket_timeout:'5'}))url.searchParams.set(k,v);
  const connect=()=>new PrismaClient({datasources:{db:{url:url.toString()}},log:[],errorFormat:'minimal'});client=connect();
  await t.test('runtime startup validates live PostgreSQL without migration-history or SQLite access',async()=>{await verifyPostgresStartup(sql=>client!.$queryRawUnsafe(sql));});
  const taskBody={title:'Isolated fixture',studio:'Niko',agentId:'fixture'};
  await t.test('activity failure rolls back task insertion; no accepted or deferred partial write',async()=>{
   const failing=client!.$extends({query:{activity:{create:async()=>{throw Object.assign(new Error('Fixture disconnected'),{code:'P1001'})}}}});
   app=await buildApp({database:failing as unknown as typeof db,provider:'postgresql'});
   const result=await app.inject({method:'POST',url:'/tasks',payload:taskBody});assert.equal(result.statusCode,503);
   assert.equal(await client!.task.count(),0);assert.equal(await client!.activity.count(),0);await app.close();app=undefined;
  });
  app=await buildApp({database:client as unknown as typeof db,provider:'postgresql'});
  const created=await app.inject({method:'POST',url:'/tasks',payload:taskBody});assert.equal(created.statusCode,201);const id=created.json().id as string;
  await t.test('real concurrent Done requests serialize and produce exactly one completion report',async()=>{
   const responses=await Promise.all(Array.from({length:4},()=>app!.inject({method:'PATCH',url:'/tasks/'+id,payload:{status:'Done'}})));
   for(const response of responses)assert.equal(response.statusCode,200);
   assert.equal((await client!.task.findUniqueOrThrow({where:{id}})).status,'Done');assert.equal(await client!.agentReport.count({where:{taskId:id}}),1);
   assert.equal(await client!.activity.count(),1);
  });
  await t.test('report failure rolls back the corresponding task transition',async()=>{
   const pending=await client!.task.create({data:{...taskBody,title:'Rollback fixture'}});
   const failing=client!.$extends({query:{agentReport:{create:async()=>{throw Object.assign(new Error('Fixture report failure'),{code:'P1001'})}}}});
   const failingApp=await buildApp({database:failing as unknown as typeof db,provider:'postgresql'});
   try{assert.equal((await failingApp.inject({method:'PATCH',url:'/tasks/'+pending.id,payload:{status:'Done'}})).statusCode,503);assert.equal((await client!.task.findUniqueOrThrow({where:{id:pending.id}})).status,'Backlog');assert.equal(await client!.agentReport.count({where:{taskId:pending.id}}),0)}finally{await failingApp.close()}
  });
  await t.test('recreated API/client preserve PostgreSQL data and rejected writes do not reappear',async()=>{
   await app!.close();client=connect();await verifyPostgresStartup(sql=>client!.$queryRawUnsafe(sql));app=await buildApp({database:client as unknown as typeof db,provider:'postgresql'});
   const state=await app.inject({method:'GET',url:'/state'});assert.equal(state.statusCode,200);assert.equal(state.json().tasks.length,2);
   assert.equal(state.json().tasks.find((x:{id:string})=>x.id===id).status,'Done');assert.equal(await client!.agentReport.count(),1);assert.equal(await client!.activity.count(),1);
  });
 }finally{
  await app?.close();await client?.$disconnect();
  if(started)run('pg_ctl',['-D',cluster,'-m','fast','-w','stop']);
  const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep));rmSync(target,{recursive:true,force:true});
 }
});
