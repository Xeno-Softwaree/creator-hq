export async function verifyPostgresStartup(query:(sql:string)=>Promise<Record<string,unknown>[]>){
 const [identity]=await query(`SELECT current_user='creator_hq_runtime' AS runtime,
 current_database()='postgres' AS database_ok, current_schema()='creator_hq' AS schema_ok,
 has_schema_privilege(current_user,'creator_hq','USAGE') AS schema_usage,
 has_schema_privilege(current_user,'creator_hq','CREATE') AS schema_create,
 has_database_privilege(current_user,current_database(),'CREATE') AS database_create,
 NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema' AND has_schema_privilege(current_user,oid,'CREATE')) AS no_schema_ddl,
 NOT EXISTS(SELECT 1 FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS no_owned_relations,
 (SELECT rolcanlogin AND NOT(rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolbypassrls OR rolreplication) FROM pg_roles WHERE rolname=current_user) AS restricted,
 NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS no_memberships`);
 if(!identity?.runtime||!identity.database_ok||!identity.schema_ok||!identity.schema_usage||identity.schema_create||identity.database_create||!identity.no_schema_ddl||!identity.no_owned_relations||!identity.restricted||!identity.no_memberships)throw new Error('POSTGRES_RUNTIME_IDENTITY_OR_PRIVILEGES_INVALID');
 const tables=await query(`SELECT c.relname,c.relrowsecurity,
 has_table_privilege(current_user,c.oid,'SELECT') AND has_table_privilege(current_user,c.oid,'INSERT') AND has_table_privilege(current_user,c.oid,'UPDATE') AND has_table_privilege(current_user,c.oid,'DELETE') AS crud,
 pg_get_userbyid(c.relowner)=current_user AS owned,
 has_table_privilege(current_user,c.oid,'TRUNCATE') AS truncate
 FROM pg_class c WHERE c.relnamespace='creator_hq'::regnamespace AND c.relkind IN ('r','p')`);
 const expected=['Studio','Agent','Task','Activity','Approval','StudioSettings','AgentReport','ApplicationSetting','ArtifactReference','ExecutionJob'];
 if(!tables.some(t=>t.relname==='_prisma_migrations'&&!t.owned)||expected.some(name=>!tables.some(t=>t.relname===name&&t.relrowsecurity&&t.crud&&!t.owned&&!t.truncate)))throw new Error('POSTGRES_APPLICATION_SCHEMA_NOT_READY');
 const history=await query(`SELECT 1 FROM pg_class c WHERE c.relnamespace='creator_hq'::regnamespace AND c.relname='_prisma_migrations' AND (has_table_privilege(current_user,c.oid,'SELECT') OR has_table_privilege(current_user,c.oid,'INSERT') OR has_table_privilege(current_user,c.oid,'UPDATE') OR has_table_privilege(current_user,c.oid,'DELETE') OR has_table_privilege(current_user,c.oid,'TRUNCATE'))`);
 if(history.length)throw new Error('POSTGRES_RUNTIME_HISTORY_ACCESS_DENIED');
}
