import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {verifyPostgresStartup} from './startup.js';
test('PostgreSQL client initialization never requires legacy files or imports SQLite',()=>{
 const url=new URL('postgresql://db.abcdefghijklmnopqrst.supabase.co/postgres');url.username='creator_hq_runtime';url.password='fixture';
 for(const [k,v] of Object.entries({schema:'creator_hq',sslmode:'require',sslaccept:'strict',connect_timeout:'1',pool_timeout:'1',socket_timeout:'1',connection_limit:'1'}))url.searchParams.set(k,v);
 const code="const {db,databaseProvider}=await import('./src/db.ts');if(databaseProvider!=='postgresql'||process.moduleLoadList.some(x=>x.includes('node:sqlite')))process.exitCode=1;await db.$disconnect();";
 const env={...process.env,NODE_ENV:'test',DATABASE_PROVIDER:'postgresql',DATABASE_URL:url.toString(),DIRECT_URL:'',SUPABASE_PROJECT_REF:'abcdefghijklmnopqrst',DATABASE_CUTOVER_APPROVED:'true',DATABASE_VERIFICATION_FILE:'missing-evidence.json',SQLITE_SOURCE_PATH:'missing-source.db'};
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',code],{env,encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,'PostgreSQL initialization must work without legacy files or network access');
});
test('startup validation fails closed for wrong role, missing RLS and exposed history',async()=>{
 const identity={runtime:true,database_ok:true,schema_ok:true,schema_usage:true,schema_create:false,database_create:false,no_schema_ddl:true,no_owned_relations:true,restricted:true,no_memberships:true};
 const tables=['Studio','Agent','Task','Activity','Approval','StudioSettings','AgentReport','ApplicationSetting','ArtifactReference','ExecutionJob','_prisma_migrations'].map(relname=>({relname,relrowsecurity:true,crud:true,owned:false,truncate:false}));
 const run=(first:Record<string,unknown>,rows:Record<string,unknown>[],history:Record<string,unknown>[]=[])=>(()=>{let i=0;return verifyPostgresStartup(async()=>[ [first],rows,history ][i++])})();
 await run(identity,tables);
 await assert.rejects(run({...identity,runtime:false},tables),/IDENTITY_OR_PRIVILEGES/);
 await assert.rejects(run(identity,tables.map(t=>({...t,relrowsecurity:false}))),/SCHEMA_NOT_READY/);
 await assert.rejects(run(identity,tables,[{history:true}]),/HISTORY_ACCESS/);
});
