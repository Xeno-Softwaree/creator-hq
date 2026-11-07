import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const security=(name:string)=>readFileSync('prisma/postgresql/security/'+name+'.sql','utf8');

test('runtime connection inspection is read-only and does not equate SET ROLE or empty tables with readiness',async()=>{
 const database=new PGlite();
 try{
  await database.exec(security('bootstrap-role'));await database.exec(security('prepare-schema'));
  const query=security('inspect-runtime-connection');
  await database.exec('SET ROLE creator_hq_runtime');
  const empty=await database.exec(query);
  assert.ok(empty.some(result=>result.rows.some(row=>(row as {runtime_credential_session?:boolean}).runtime_credential_session===false)));
  assert.ok(empty.some(result=>result.rows.some(row=>(row as {table_permission_status?:string}).table_permission_status==='NOT_TESTED_NO_TABLES')));
  assert.ok(empty.some(result=>result.rows.some(row=>(row as {read_only?:string}).read_only==='on')));
  await database.exec('RESET ROLE; CREATE TABLE creator_hq.connection_fixture (id text); ALTER TABLE creator_hq.connection_fixture ENABLE ROW LEVEL SECURITY; GRANT SELECT ON creator_hq.connection_fixture TO creator_hq_runtime; SET ROLE creator_hq_runtime');
  const populated=await database.exec(query);
  const rights=populated.flatMap(result=>result.rows).find(row=>(row as {relname?:string}).relname==='connection_fixture') as {select_rows:boolean;insert_rows:boolean;truncate_rows:boolean};
  assert.equal(rights.select_rows,true);assert.equal(rights.insert_rows,false);assert.equal(rights.truncate_rows,false);
 }finally{await database.close()}
});
async function rejected(database:PGlite,sql:string,code:RegExp){
 await assert.rejects(()=>database.exec(sql),code);
 await database.exec('ROLLBACK');
}

test('non-superuser role creator triggers automatic-membership hold without leaving a runtime role',async()=>{
 const database=new PGlite();
 try{
  const version=Number((await database.query<{server_version_num:string}>('SHOW server_version_num')).rows[0].server_version_num);
  assert.ok(version>=160000);
  await database.exec('CREATE ROLE inspection_operator CREATEROLE NOINHERIT; SET ROLE inspection_operator');
  await assert.rejects(()=>database.exec(security('bootstrap-role')),/RUNTIME_ROLE_REVIEW_REQUIRED/);
  await database.exec('RESET ROLE');
  assert.equal((await database.query("SELECT 1 FROM pg_roles WHERE rolname='creator_hq_runtime'")).rows.length,0);
 }finally{await database.close()}
});

test('preparation stops for global and scoped defaults without changing shared roles or defaults',async()=>{
 const database=new PGlite();
 try{
  await database.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE system_fixture;');
  await database.exec(security('bootstrap-role'));
  const roleState=JSON.stringify((await database.query("SELECT rolname,rolcanlogin,rolbypassrls,rolinherit FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','system_fixture') ORDER BY rolname")).rows);
  // All ACL changes below exist only in this disposable in-memory database.
  for(const kind of ['TABLES','SEQUENCES']){
   await database.exec(`ALTER DEFAULT PRIVILEGES GRANT SELECT ON ${kind} TO service_role`);
   const defaults=JSON.stringify((await database.query('SELECT * FROM pg_default_acl ORDER BY oid')).rows);
   await rejected(database,security('prepare-schema'),/GLOBAL_DEFAULT_ACL_REVIEW_REQUIRED/);
   assert.equal(JSON.stringify((await database.query('SELECT * FROM pg_default_acl ORDER BY oid')).rows),defaults);
   assert.equal((await database.query("SELECT 1 FROM pg_namespace WHERE nspname='creator_hq'")).rows.length,0);
   await database.exec(`ALTER DEFAULT PRIVILEGES REVOKE SELECT ON ${kind} FROM service_role`);
  }
  await database.exec(security('prepare-schema'));
  await database.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA creator_hq GRANT EXECUTE ON FUNCTIONS TO authenticated');
  await rejected(database,security('prepare-schema'),/SCHEMA_DEFAULT_ACL_REVIEW_REQUIRED/);
  assert.equal(JSON.stringify((await database.query("SELECT rolname,rolcanlogin,rolbypassrls,rolinherit FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','system_fixture') ORDER BY rolname")).rows),roleState);
 }finally{await database.close()}
});

test('preparation refuses existing objects, grants, LOGIN and memberships instead of repairing them',async()=>{
 const database=new PGlite();
 try{
  await database.exec(security('bootstrap-role'));await database.exec(security('prepare-schema'));
  await database.exec('CREATE TABLE creator_hq.sentinel (id text); INSERT INTO creator_hq.sentinel VALUES (\'preserved\')');
  await rejected(database,security('prepare-schema'),/EXISTING_SCHEMA_OBJECTS_REVIEW_REQUIRED/);
  assert.equal((await database.query<{id:string}>('SELECT id FROM creator_hq.sentinel')).rows[0].id,'preserved');
  // Only the disposable fixture is reset between cases; never a project database.
  await database.exec('DROP TABLE creator_hq.sentinel; CREATE ROLE service_role; GRANT USAGE ON SCHEMA creator_hq TO service_role');
  await rejected(database,security('prepare-schema'),/EXISTING_SCHEMA_ACL_REVIEW_REQUIRED/);
  assert.equal((await database.query<{allowed:boolean}>("SELECT has_schema_privilege('service_role','creator_hq','USAGE') AS allowed")).rows[0].allowed,true);
  await database.exec('ALTER ROLE creator_hq_runtime LOGIN');
  await rejected(database,security('bootstrap-role'),/RUNTIME_ROLE_REVIEW_REQUIRED/);
  assert.equal((await database.query<{rolcanlogin:boolean}>("SELECT rolcanlogin FROM pg_roles WHERE rolname='creator_hq_runtime'")).rows[0].rolcanlogin,true);
  await database.exec('ALTER ROLE creator_hq_runtime NOLOGIN; CREATE ROLE system_fixture; GRANT system_fixture TO creator_hq_runtime');
  await rejected(database,security('bootstrap-role'),/RUNTIME_ROLE_REVIEW_REQUIRED/);
 }finally{await database.close()}
});

test('read-only audits report ownership, RLS, global defaults and exact counts without exposing row content',async()=>{
 const database=new PGlite();
 try{
  await database.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS');
  await database.exec(security('bootstrap-role'));await database.exec(security('prepare-schema'));
  await database.exec('CREATE TABLE creator_hq.sentinel (id text); INSERT INTO creator_hq.sentinel VALUES (\'private-fixture-content\'); CREATE SEQUENCE creator_hq.test_sequence');
  // Demonstrate the PostgreSQL trap: scoped REVOKE does not cancel built-in
  // global PUBLIC EXECUTE. The function is inspected, never invoked.
  await database.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA creator_hq REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC; CREATE FUNCTION creator_hq.test_function() RETURNS integer LANGUAGE sql AS \'SELECT 1\'');
  assert.equal((await database.query<{allowed:boolean}>("SELECT has_function_privilege('anon','creator_hq.test_function()','EXECUTE') AS allowed")).rows[0].allowed,true);
  const before=JSON.stringify((await database.query('SELECT * FROM pg_default_acl ORDER BY oid')).rows);
  const results=await database.exec(security('inspect-security'));
  assert.ok(results.some(result=>result.rows.some(row=>(row as {read_only?:string}).read_only==='on')));
  assert.ok(results.some(result=>result.rows.some(row=>(row as {assessment?:string}).assessment==='FUTURE_ROUTINE_REVIEW_REQUIRED')));
  assert.ok(!JSON.stringify(results).includes('private-fixture-content'));
  const notices:string[]=[];
  await database.exec(security('inspect-existing-data'),{onNotice:notice=>notices.push(notice.message??'')});
  assert.ok(notices.some(message=>message.includes('EXACT_VISIBLE_COUNT: sentinel = 1')));
  assert.ok(notices.some(message=>message.includes('BLOCKER_EXISTING_DATA_REVIEW_REQUIRED')));
  assert.ok(!notices.join().includes('private-fixture-content'));
  assert.equal(JSON.stringify((await database.query('SELECT * FROM pg_default_acl ORDER BY oid')).rows),before);
  assert.equal((await database.query('SELECT * FROM creator_hq.sentinel')).rows.length,1);
 }finally{await database.close()}
});
