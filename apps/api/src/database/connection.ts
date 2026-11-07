import type {SqlTarget} from './transfer.js';

// Catalog reads only: this check is usable before any application table exists.
export async function checkConnectionAccess(runtime:SqlTarget,administrative:SqlTarget){
 const identity=await runtime.query('SELECT current_user AS role, current_database() AS database');
 const owner=await administrative.query('SELECT current_user AS role, current_database() AS database');
 if(identity[0]?.role!=='creator_hq_runtime'||identity[0]?.database!=='postgres')throw new Error('RUNTIME_CONNECTION_IDENTITY_MISMATCH');
 if(!owner[0]?.role||owner[0].role==='creator_hq_runtime'||owner[0].database!=='postgres')throw new Error('SEPARATE_ADMINISTRATIVE_ROLE_REQUIRED');
 const roles=await runtime.query("SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls,rolreplication FROM pg_roles WHERE rolname=current_user");
 const role=roles[0];
 if(!role?.rolcanlogin||role.rolsuper||role.rolcreatedb||role.rolcreaterole||role.rolinherit||role.rolbypassrls||role.rolreplication)throw new Error('UNSAFE_RUNTIME_ROLE');
 const memberships=await runtime.query('SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)');
 if(memberships.length)throw new Error('RUNTIME_ROLE_MEMBERSHIP_REVIEW_REQUIRED');
 const databaseCreate=await runtime.query("SELECT has_database_privilege(current_user,current_database(),'CREATE') AS allowed");
 const schemaCreate=await runtime.query("SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema' AND has_schema_privilege(current_user,oid,'CREATE')");
 const ownership=await runtime.query('SELECT 1 FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) LIMIT 1');
 if(databaseCreate[0]?.allowed||schemaCreate.length||ownership.length)throw new Error('RUNTIME_DDL_PRIVILEGE_REVIEW_REQUIRED');
 const historyAccess=await runtime.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='creator_hq' AND c.relname='_prisma_migrations' AND (has_table_privilege(current_user,c.oid,'SELECT') OR has_table_privilege(current_user,c.oid,'INSERT') OR has_table_privilege(current_user,c.oid,'UPDATE') OR has_table_privilege(current_user,c.oid,'DELETE'))");
 if(historyAccess.length)throw new Error('RUNTIME_MIGRATION_HISTORY_ACCESS');
 return {connection:'verified',runtimeIdentity:true,separateAdministrativeIdentity:true,runtimeRoleRestricted:true,runtimePermanentDdlAllowed:false,migrationHistoryAccessible:false,applicationSchemaRequired:false,dataApiSetting:'not-verified-by-sql'};
}
