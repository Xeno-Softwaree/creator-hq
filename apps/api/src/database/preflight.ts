import type {SqlTarget} from './transfer.js';
export async function inspectPostgresSecurity(target:SqlTarget){
 const roles=await target.query("SELECT rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit,rolreplication FROM pg_roles WHERE rolname='creator_hq_runtime'");
 if(roles.length!==1||roles[0].rolsuper||roles[0].rolbypassrls||roles[0].rolcreatedb||roles[0].rolcreaterole||roles[0].rolinherit||roles[0].rolreplication)throw new Error('UNSAFE_RUNTIME_ROLE');
 const membership=await target.query("SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='creator_hq_runtime')");if(membership.length)throw new Error('RUNTIME_ROLE_MEMBERSHIP_REVIEW_REQUIRED');
 const tables=await target.query("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='creator_hq'");
 const expected=['Studio','Agent','Task','Activity','Approval','StudioSettings','AgentReport','ApplicationSetting','ArtifactReference','ExecutionJob'];
 if(expected.some(name=>!tables.some(table=>table.tablename===name&&table.rowsecurity===true)))throw new Error('PRIVATE_SCHEMA_SECURITY_NOT_READY');
 const exposed=await target.query("SELECT grantee FROM information_schema.role_table_grants WHERE table_schema='creator_hq' AND grantee IN ('PUBLIC','anon','authenticated')");if(exposed.length)throw new Error('UNEXPECTED_PUBLIC_TABLE_GRANT');
 const schemaAccess=await target.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') AND has_schema_privilege(rolname,'creator_hq','USAGE')");if(schemaAccess.length)throw new Error('UNEXPECTED_PUBLIC_SCHEMA_ACCESS');
 const publicPolicies=await target.query("SELECT policyname FROM pg_policies WHERE schemaname='creator_hq' AND roles && ARRAY['public','anon','authenticated']::name[]");if(publicPolicies.length)throw new Error('UNEXPECTED_PUBLIC_RLS_POLICY');
 return {roleRestricted:true,tableRlsEnabled:true,publicTableGrants:false,publicSchemaAccess:false,dataApiSetting:'not-verified-by-sql'};
}
