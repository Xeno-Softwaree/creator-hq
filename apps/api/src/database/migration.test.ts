import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,mkdtempSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {transferSnapshot,type SqlTarget} from './transfer.js';
import {makeSnapshot,fields,tableNames,readSnapshot,backupSqlite,digest,type Row,type TableName} from './snapshot.js';
import {postgresUrl,databaseConfiguration} from './config.js';
import {checkConnectionAccess} from './connection.js';

test('reviewed role/schema preparation is repeatable and denies runtime migration access',async()=>{
 const database=new PGlite();
 const target=(runtime=false):SqlTarget=>({query:async(sql,parameters=[])=>{
  if(runtime)await database.exec('SET ROLE creator_hq_runtime');
  try{return (await database.query<Record<string,unknown>>(sql,parameters)).rows}finally{if(runtime)await database.exec('RESET ROLE')}
 },transaction:()=>{throw new Error('READ_ONLY_CHECK_ONLY')}});
 try{
  await database.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  const bootstrap=readFileSync('prisma/postgresql/security/bootstrap-role.sql','utf8');
  const schema=readFileSync('prisma/postgresql/security/prepare-schema.sql','utf8');
  await database.exec(bootstrap);await database.exec(bootstrap);
  await database.exec(schema);await database.exec(schema);
  assert.equal((await database.query("SELECT tablename FROM pg_tables WHERE schemaname='creator_hq'")).rows.length,0);
  assert.equal((await database.query<{rolcanlogin:boolean}>("SELECT rolcanlogin FROM pg_roles WHERE rolname='creator_hq_runtime'")).rows[0].rolcanlogin,false);
  await database.exec('ALTER ROLE creator_hq_runtime LOGIN;');
  assert.equal((await checkConnectionAccess(target(true),target())).runtimeRoleRestricted,true);
  await assert.rejects(()=>checkConnectionAccess(target(true),target(true)),/SEPARATE_ADMINISTRATIVE_ROLE_REQUIRED/);
  await database.exec('CREATE TABLE creator_hq._prisma_migrations (id text);');
  await database.exec(readFileSync('prisma/postgresql/migrations/20261106000100_phase12_initial/migration.sql','utf8'));
  assert.equal((await checkConnectionAccess(target(true),target())).migrationHistoryAccessible,false);
  await database.exec('GRANT SELECT ON creator_hq._prisma_migrations TO creator_hq_runtime');
  await assert.rejects(()=>checkConnectionAccess(target(true),target()),/RUNTIME_MIGRATION_HISTORY_ACCESS/);
  await database.exec('REVOKE SELECT ON creator_hq._prisma_migrations FROM creator_hq_runtime; GRANT CREATE ON SCHEMA creator_hq TO creator_hq_runtime');
  await assert.rejects(()=>checkConnectionAccess(target(true),target()),/RUNTIME_DDL_PRIVILEGE_REVIEW_REQUIRED/);
  await database.exec('REVOKE CREATE ON SCHEMA creator_hq FROM creator_hq_runtime; ALTER ROLE creator_hq_runtime CREATEDB');
  await assert.rejects(()=>checkConnectionAccess(target(true),target()),/UNSAFE_RUNTIME_ROLE/);
 }finally{await database.close()}
});
function fixture(){
 const tables=Object.fromEntries(tableNames.map(table=>[table,[]])) as unknown as Record<TableName,Row[]>;
 tables.Agent=Array.from({length:9},(_,i)=>({id:'agent-'+i,name:'Agent '+i,role:'Test role',studio:i%2?'Niko':'Son Yedek',instructions:'Keep original text çğışü',enabled:true}));
 tables.StudioSettings=[{id:'Niko',contentLanguage:'en-US'},{id:'Son Yedek',contentLanguage:'tr-TR'}];
 const createdAt='2026-01-02T03:04:05.123Z';tables.Task=[{id:'task-1',title:"User title '; SELECT 1; -- ç",description:'Keep original',studio:'Niko',status:'Review',agentId:'agent-1',createdAt,updatedAt:createdAt}];
 tables.Activity=[{id:'activity-1',agentId:'agent-1',message:'Original event',simulated:true,createdAt}];
 tables.Approval=[{id:'approval-1',title:'Original approval',agentId:'agent-1',status:'Approved',simulated:true,createdAt}];
 tables.AgentReport=[{id:'report-1',sourceId:'activity-1',agentId:'agent-1',taskId:'task-1',approvalId:'approval-1',source:'simulation',status:'completed',summaryData:'{"template":"simulation"}',originalTechnicalReport:'E_TEST relative/file.ts',createdAt}];
 return makeSnapshot(tables);
}
test('real PostgreSQL engine applies private schema and transfers idempotently without loss',async()=>{
 const database=new PGlite();try{
  await database.exec('CREATE ROLE creator_hq_runtime NOINHERIT; CREATE ROLE anon; CREATE ROLE authenticated;');
  const sql=readFileSync('prisma/postgresql/migrations/20261106000100_phase12_initial/migration.sql','utf8');assert.doesNotMatch(sql,/\bDROP\b|TRUNCATE/i);await database.exec(sql);assert.equal((await database.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('Agent','Task','Approval')")).rows.length,0);
  const adapt=(db:Pick<PGlite,'query'>):SqlTarget=>({query:async(sql,parameters=[]) => (await db.query<Record<string,unknown>>(sql,parameters)).rows,transaction:operation=>database.transaction(async transaction=>operation(adapt(transaction as unknown as Pick<PGlite,'query'>)))});
  const target=adapt(database),source=fixture();
  await assert.rejects(()=>transferSnapshot({...fixture(),fingerprint:'0'.repeat(64)},target,true),/SOURCE_MANIFEST_MISMATCH/);
  const dry=await transferSnapshot(source,target);assert.equal(dry.verified,false);assert.equal(dry.destinationCounts.Agent,0);
  const first=await transferSnapshot(source,target,true);assert.equal(first.verified,true);assert.deepEqual(first.destinationCounts,source.counts);
  const second=await transferSnapshot(source,target,true);assert.deepEqual(second.destinationCounts,first.destinationCounts);assert.equal(second.destinationFingerprint,source.fingerprint);
  const evidence=resolve('../../.local/phase12');mkdirSync(evidence,{recursive:true});writeFileSync(join(evidence,'isolated-transfer-verification.json'),JSON.stringify({...second,environment:'isolated-pglite',liveSupabase:false,runtimeVerified:false},null,2));
  await assert.rejects(()=>database.query('INSERT INTO creator_hq."Task" (id,title,studio,"agentId","updatedAt") VALUES ($1,$2,$3,$4,now())',['bad','Bad','Niko','missing-agent']));
  await assert.rejects(()=>database.query('UPDATE creator_hq."Task" SET status=$1 WHERE id=$2',['Published','task-1']));
  await assert.rejects(()=>database.query('DELETE FROM creator_hq."Agent" WHERE id=$1',['agent-1']));
  await database.exec('SET ROLE anon');await assert.rejects(()=>database.query('SELECT * FROM creator_hq."Agent"'));await database.exec('RESET ROLE');
  await database.exec('SET ROLE creator_hq_runtime');assert.equal((await database.query('SELECT * FROM creator_hq."Agent"')).rows.length,9);await assert.rejects(()=>database.exec('CREATE TABLE creator_hq.unapproved (id text)'));await database.exec('RESET ROLE');
  await database.query('UPDATE creator_hq."Task" SET description=$1 WHERE id=$2',['different','task-1']);await assert.rejects(()=>transferSnapshot(source,target,true),/TARGET_ROW_CONFLICT/);
  assert.equal((await database.query<{description:string}>('SELECT description FROM creator_hq."Task" WHERE id=$1',['task-1'])).rows[0].description,'different');
 }finally{await database.close()}
});
test('snapshot rejects orphan relationships, unknown status and edited manifests',()=>{
 const source=fixture();source.tables.Task[0].agentId='missing';assert.throws(()=>makeSnapshot(source.tables),/ORPHAN_AGENT_REFERENCE/);
 const invalid=fixture();invalid.tables.Approval[0].status='Published';assert.throws(()=>makeSnapshot(invalid.tables),/INVALID_APPROVAL_STATUS/);
});
test('SQLite backup is readable, preserves timestamps and never changes source bytes',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'creator-hq-backup-test-'));const path=join(directory,'source.db');const database=new DatabaseSync(path);
 try{
  const snapshot=fixture();
  for(const table of tableNames){database.exec(`CREATE TABLE "${table}" (${fields[table].map(field=>`"${field}" ${['enabled','simulated','createdAt','updatedAt'].includes(field)?'INTEGER':'TEXT'}`).join(',')})`);for(const row of snapshot.tables[table]){const values=fields[table].map(field=>['createdAt','updatedAt'].includes(field)?new Date(String(row[field])).getTime():typeof row[field]==='boolean'?Number(row[field]):row[field]);database.prepare(`INSERT INTO "${table}" VALUES (${values.map(()=>'?').join(',')})`).run(...values);}}
 }finally{database.close()}
 const before=digest(readFileSync(path).toString('base64'));
 try{const backup=await backupSqlite(path,join(directory,'backups'));assert.equal(readSnapshot(backup.path).fingerprint,readSnapshot(path).fingerprint);assert.equal(digest(readFileSync(path).toString('base64')),before);assert.equal(backup.snapshot.tables.Agent.length,9)}finally{const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep));rmSync(target,{recursive:true,force:true})}
});
function environment(){
 const reference='abcdefghijklmnopqrst';const url=new URL('postgresql://db.'+reference+'.supabase.co:5432/postgres');url.username='creator_hq_runtime';url.password=['test','password'].join('-');for(const [key,value] of Object.entries({schema:'creator_hq',sslmode:'require',sslaccept:'strict',connect_timeout:'10',pool_timeout:'10',socket_timeout:'20',connection_limit:'5'}))url.searchParams.set(key,value);
 return {SUPABASE_PROJECT_REF:reference,DATABASE_URL:url.toString(),DIRECT_URL:url.toString()};
}
test('connection policy fails closed before credentials or unsafe cutover can be used',()=>{
 assert.throws(()=>databaseConfiguration({}),/DATABASE_PROVIDER_REQUIRED/);assert.equal(databaseConfiguration({DATABASE_PROVIDER:'sqlite'}).provider,'sqlite');assert.throws(()=>postgresUrl(undefined,{},'runtime'),/DATABASE_URL_REQUIRED/);
 const env=environment();assert.ok(postgresUrl(env.DATABASE_URL,env,'runtime').projectIdentity);assert.throws(()=>databaseConfiguration({...env,DATABASE_PROVIDER:'postgresql'}),/VERIFIED_CUTOVER_APPROVAL_REQUIRED/);
 const insecure=new URL(env.DATABASE_URL);insecure.searchParams.set('sslmode','prefer');assert.throws(()=>postgresUrl(insecure.toString(),env,'runtime'),/STRICT_DATABASE_TLS_REQUIRED/);
 const wrong=new URL(env.DATABASE_URL);wrong.hostname='db.wrongproject.supabase.co';assert.throws(()=>postgresUrl(wrong.toString(),env,'runtime'),/DATABASE_PROJECT_MISMATCH/);
 const pooled=new URL(env.DATABASE_URL);pooled.port='6543';assert.throws(()=>postgresUrl(pooled.toString(),env,'migration'),/MIGRATION_SESSION_CONNECTION_REQUIRED/);
});

test('PostgreSQL runtime requires explicit opt-in but no historical receipt or SQLite file',()=>{
 const env=environment();
 const configuration={...env,DIRECT_URL:undefined,DATABASE_PROVIDER:'postgresql',DATABASE_CUTOVER_APPROVED:'true',DATABASE_VERIFICATION_FILE:'nonexistent-history.json',SQLITE_SOURCE_PATH:'nonexistent-source.db'};
 assert.equal(databaseConfiguration(configuration).provider,'postgresql');
 assert.throws(()=>databaseConfiguration({...configuration,DATABASE_CUTOVER_APPROVED:'false'}),/VERIFIED_CUTOVER_APPROVAL_REQUIRED/);
 assert.throws(()=>databaseConfiguration({...configuration,DIRECT_URL:'forbidden-administrative-setting'}),/ADMINISTRATIVE_URL_NOT_ALLOWED_IN_RUNTIME/);
});

test('staging CLI does not inherit the active SQLite URL before checking credentials',()=>{
 const directory=mkdtempSync(join(tmpdir(),'creator-hq-staging-test-'));const path=join(directory,'migration.env');
 try{
  writeFileSync(path,'DATABASE_URL=\nDIRECT_URL=\nSUPABASE_PROJECT_REF=\n');const env:NodeJS.ProcessEnv={...process.env,MIGRATION_ENV_FILE:path};delete env.DATABASE_URL;delete env.DIRECT_URL;delete env.SUPABASE_PROJECT_REF;
  for(const mode of ['--preflight','--check-connection']){const result=spawnSync(process.execPath,[resolve('../../node_modules/tsx/dist/cli.mjs'),'src/database/migrate.ts',mode],{env,encoding:'utf8'});assert.equal(result.status,1);assert.match(result.stderr,/DATABASE_URL_REQUIRED/);assert.ok(!result.stderr.includes('file:./creator.db'));}
  const mixed=spawnSync(process.execPath,[resolve('../../node_modules/tsx/dist/cli.mjs'),'src/database/migrate.ts','--check-connection','--apply-schema'],{env,encoding:'utf8'});assert.equal(mixed.status,1);assert.match(mixed.stderr,/READ_ONLY_CONNECTION_MODE_REQUIRED/);
 }finally{const target=resolve(directory);assert.ok(target.startsWith(resolve(tmpdir())+sep));rmSync(target,{recursive:true,force:true})}
});
