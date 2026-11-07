import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {integrationHeader} from '../execution/prepare-runtime.js';
import {NATIVE_EXECUTION_RELEASE_APPROVED} from '../execution/release.js';
import {ExecutionJobs,executionSchemaReady,type JobDatabase} from '../execution/jobs.js';
import {NativeCodexLauncher} from '../execution/launcher.js';
import {makeContract,contractDigest} from '../execution/contract.js';
import {isolateApiTestEnvironment} from './test-environment.js';
import {isolatedPostgres} from './execution-test-fixture.js';
import {assertReviewedMigrationHistory,assertReviewedMigrationFiles,reviewedMigrations} from './migration-history.js';
isolateApiTestEnvironment('file:./unused-activation.db');
const activation=readFileSync(new URL('../../prisma/postgresql/review/atlas-activation.sql',import.meta.url),'utf8');
const rollback=readFileSync(new URL('../../prisma/postgresql/review/atlas-rollback.sql',import.meta.url),'utf8');
test('integration inventory reads section identities but never interprets credential values',()=>{
 assert.deepEqual(integrationHeader('[mcp_servers."fake-server".env]'),{kind:'mcp_servers',id:'fake-server'});assert.deepEqual(integrationHeader('[plugins."fake@plugin"]'),{kind:'plugins',id:'fake@plugin'});assert.equal(integrationHeader('PRIVATE_VALUE = "synthetic"'),null);
 for(const line of ['[mcp_servers."bad.id"]','[plugins.fake.env]','[mcp_servers.fake.unknown]'])assert.throws(()=>integrationHeader(line),/REVIEW_REQUIRED/);
});
test('reviewed native worker stays code-locked and untrusted launchers cannot claim work',async()=>{
 assert.equal(NATIVE_EXECUTION_RELEASE_APPROVED,false);assert.equal(new NativeCodexLauncher().kind,'disabled');
 assert.equal(await new ExecutionJobs({} as JobDatabase,new NativeCodexLauncher()).availability(),false);
 assert.throws(()=>new ExecutionJobs({} as JobDatabase,{kind:'native',execute:async()=>({version:1,summary:'synthetic',actions:[],outcome:'completed'})}),/NATIVE_REVIEW_REQUIRED/);
});
test('migration history permits only a successful checksum-bound contiguous reviewed sequence',()=>{
 const rows=reviewedMigrations.map(m=>({migration_name:m.name,checksum:m.checksum,finished_at:new Date(),rolled_back_at:null}));assert.doesNotThrow(()=>assertReviewedMigrationHistory(rows));assert.doesNotThrow(()=>assertReviewedMigrationHistory(rows.slice(0,1)));
 for(const bad of [[rows[1]],[...rows,rows[0]],[{...rows[0],checksum:'changed'}],[{...rows[0],finished_at:null}],[{...rows[0],migration_name:'unknown'}]])assert.throws(()=>assertReviewedMigrationHistory(bad),/MIGRATION_HISTORY_REVIEW_REQUIRED/);
});
test('currently discoverable migration files remain restricted to reviewed bytes',()=>{
 const source=fileURLToPath(new URL('../../prisma/postgresql/migrations',import.meta.url));assert.doesNotThrow(()=>assertReviewedMigrationFiles(source));
 const directory=mkdtempSync(join(tmpdir(),'creator-migration-policy-'));try{const name=reviewedMigrations[0].name;mkdirSync(join(directory,name));const file=join(directory,name,'migration.sql');writeFileSync(file,readFileSync(join(source,name,'migration.sql')));assert.doesNotThrow(()=>assertReviewedMigrationFiles(directory));writeFileSync(file,'-- altered synthetic fixture');assert.throws(()=>assertReviewedMigrationFiles(directory),/MIGRATION_FILES_REVIEW_REQUIRED/);}finally{const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep));rmSync(target,{recursive:true,force:true})}
});
test('review SQL activation and rollback preserve data and enforce only approved Atlas running rows',{skip:!process.env.CREATOR_TEST_POSTGRES_BIN,timeout:120000},async t=>{
 const fixture=await isolatedPostgres(),db=fixture.client;try{
  await db.agent.create({data:{id:'director',name:'Atlas',role:'CEO',studio:'HQ'}});const task=await db.task.create({data:{title:'Synthetic review',studio:'Niko',agentId:'director'}}),id=randomUUID();const contract=makeContract({taskId:task.id,title:task.title,description:'',studio:'Niko',agentId:'director'},'');const digest=contractDigest(contract),time=new Date().toISOString();
  const metadata={version:2,source:'codex',contract,digest,approvalId:'execution:'+id,approval:{actor:'owner',sessionAudit:'synthetic',digest,expiresAt:new Date(Date.now()+300000).toISOString(),decidedAt:time},worker:{token:randomUUID(),startedAt:time,leaseUntil:new Date(Date.now()+90000).toISOString()},cancelRequested:false,result:null,error:null};
  await db.executionJob.create({data:{id,taskId:task.id,agentId:'director',metadata}});const original=await db.executionJob.findUniqueOrThrow({where:{id}});
  await t.test('apply changes only constraints/index; original records and RLS survive',async()=>{
   assert.equal(await executionSchemaReady(db),false);fixture.adminScript(activation);assert.equal(await executionSchemaReady(db),true);assert.deepEqual(await db.executionJob.findUniqueOrThrow({where:{id}}),original);
   const rows=await db.$queryRawUnsafe<{relrowsecurity:boolean}[]>('SELECT relrowsecurity FROM pg_class WHERE oid=\'creator_hq."ExecutionJob"\'::regclass');assert.equal(rows[0].relrowsecurity,true);
   await assert.rejects(()=>db.$executeRawUnsafe('ALTER TABLE creator_hq."ExecutionJob" DROP CONSTRAINT "ExecutionJob_atlas_text_check"'));
  });
  await t.test('NULL, missing approval, fake source, tools and pending status cannot enable a job',async()=>{
   for(const bad of [{},{...metadata,approval:null},{...metadata,source:'simulation'},{...metadata,contract:{...contract,permissions:{...contract.permissions,network:'enabled'}}}])await assert.rejects(()=>db.executionJob.update({where:{id},data:{status:'running',enabled:true,metadata:bad}}));
   await assert.rejects(()=>db.executionJob.update({where:{id},data:{enabled:true}}));assert.equal((await db.executionJob.findUniqueOrThrow({where:{id}})).enabled,false);
  });
  await t.test('one approved-shaped synthetic native row can run; duplicate running row fails atomically',async()=>{
   await db.executionJob.update({where:{id},data:{status:'running',enabled:true}});const other=randomUUID();await db.executionJob.create({data:{id:other,taskId:task.id,agentId:'director',metadata:{...metadata,approvalId:'execution:'+other}}});
   await assert.rejects(()=>db.executionJob.update({where:{id:other},data:{status:'running',enabled:true}}));assert.equal((await db.executionJob.findUniqueOrThrow({where:{id:other}})).enabled,false);
  });
  await t.test('rollback refuses active work without changing schema or records',async()=>{
   assert.throws(()=>fixture.adminScript(rollback));assert.equal((await db.executionJob.findUniqueOrThrow({where:{id}})).enabled,true);
  });
  await t.test('quiescent rollback preserves records and restores unconditional disabled check',async()=>{
   await db.executionJob.update({where:{id},data:{status:'completed',enabled:false}});const before=await db.executionJob.findMany({orderBy:{id:'asc'}});fixture.adminScript(rollback);assert.equal(await executionSchemaReady(db),false);assert.deepEqual(await db.executionJob.findMany({orderBy:{id:'asc'}}),before);await assert.rejects(()=>db.executionJob.update({where:{id},data:{status:'running',enabled:true}}));
  });
 }finally{await fixture.close()}
});
