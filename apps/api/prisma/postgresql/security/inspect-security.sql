-- READ ONLY. Prepared locally; live execution requires separate operator approval.
-- Run as the intended migration owner. Keep results private; no password catalog
-- or user-authored row content is selected. No privilege/role changes occur.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';

SELECT current_database() AS database, current_user AS inspection_role,
 session_user AS login_role, current_setting('transaction_read_only') AS read_only;
SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='creator_hq') AS schema_present;

-- Missing roles remain visible. NOLOGIN is mandatory in preparation, not a
-- claim that a separately approved future runtime connection should be NOLOGIN.
WITH wanted(name) AS (VALUES ('creator_hq_runtime'),('anon'),('authenticated'),('service_role'))
SELECT w.name, r.oid IS NOT NULL AS present, r.rolcanlogin, r.rolsuper,
 r.rolcreatedb, r.rolcreaterole, r.rolinherit, r.rolbypassrls, r.rolreplication,
 r.rolconnlimit, r.rolvaliduntil,
 CASE WHEN r.rolname='creator_hq_runtime' AND
 (r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolinherit OR r.rolbypassrls OR r.rolreplication)
 THEN 'BLOCKER_PREPARATION_ROLE_FLAGS' ELSE 'REVIEW' END AS assessment
FROM wanted w LEFT JOIN pg_roles r ON r.rolname=w.name ORDER BY w.name;

-- Both directions, including membership options on PG16+ without a PG15-only
-- parse failure. NOINHERIT alone does not prevent SET ROLE through membership.
SELECT parent.rolname AS granted_role, member.rolname AS member,
 grantor.rolname AS grantor, m.admin_option,
 to_jsonb(m)->>'inherit_option' AS inherit_option,
 to_jsonb(m)->>'set_option' AS set_option
FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid
JOIN pg_roles member ON member.oid=m.member JOIN pg_roles grantor ON grantor.oid=m.grantor
WHERE parent.rolname='creator_hq_runtime' OR member.rolname='creator_hq_runtime';

WITH RECURSIVE ancestors(roleid,path) AS (
 SELECT m.roleid, ARRAY[m.member,m.roleid] FROM pg_auth_members m
 JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='creator_hq_runtime'
 UNION ALL SELECT m.roleid,a.path||m.roleid FROM ancestors a
 JOIN pg_auth_members m ON m.member=a.roleid WHERE NOT m.roleid=ANY(a.path)
)
SELECT DISTINCT r.rolname AS reachable_role, r.rolsuper, r.rolcreatedb,
 r.rolcreaterole,r.rolbypassrls,r.rolreplication FROM ancestors a JOIN pg_roles r ON r.oid=a.roleid;

-- Report setting NAMES only: custom configuration can contain secrets.
SELECT r.rolname, d.datname AS database,
 split_part(setting,'=',1) AS configured_setting
FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole
LEFT JOIN pg_database d ON d.oid=s.setdatabase
CROSS JOIN LATERAL unnest(s.setconfig) setting WHERE r.rolname='creator_hq_runtime';

-- Effective database/schema permissions include PUBLIC and inherited grants.
SELECT r.rolname, has_database_privilege(r.oid,current_database(),'CONNECT') AS connect,
 has_database_privilege(r.oid,current_database(),'CREATE') AS database_create,
 has_database_privilege(r.oid,current_database(),'TEMPORARY') AS temporary_tables
FROM pg_roles r WHERE r.rolname IN ('creator_hq_runtime','anon','authenticated','service_role');
SELECT n.nspname, pg_get_userbyid(n.nspowner) AS owner, r.rolname,
 has_schema_privilege(r.oid,n.oid,'USAGE') AS usage,
 has_schema_privilege(r.oid,n.oid,'CREATE') AS create_objects
FROM pg_namespace n CROSS JOIN pg_roles r
WHERE r.rolname='creator_hq_runtime' AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema';
SELECT n.nspname,pg_get_userbyid(n.nspowner) AS owner,
 CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
 a.privilege_type,a.is_grantable FROM pg_namespace n
CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='creator_hq';

-- Relation owners, explicit + implicit ACLs, RLS and migration history.
SELECT c.relname,c.relkind,pg_get_userbyid(c.relowner) AS owner,
 c.relrowsecurity,c.relforcerowsecurity,c.relispartition,
 CASE WHEN c.relname=ANY(ARRAY['Studio','Agent','Task','Activity','Approval','StudioSettings','AgentReport','ApplicationSetting','ArtifactReference','ExecutionJob','_prisma_migrations'])
 THEN 'KNOWN_NAME_REQUIRES_OWNER_SHAPE_DATA_REVIEW' ELSE 'BLOCKER_UNEXPECTED_RELATION' END AS assessment
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='creator_hq' ORDER BY c.relname;
SELECT c.relname,c.relkind,
 CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
 pg_get_userbyid(a.grantor) AS grantor,a.privilege_type,a.is_grantable
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S' ELSE 'r' END::"char",c.relowner))) a
WHERE n.nspname='creator_hq' AND c.relkind IN ('r','p','v','m','f','S') ORDER BY c.relname,grantee,a.privilege_type;
SELECT c.relname,att.attname,
 CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
 a.privilege_type,a.is_grantable
FROM pg_attribute att JOIN pg_class c ON c.oid=att.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN LATERAL aclexplode(att.attacl) a WHERE n.nspname='creator_hq' AND NOT att.attisdropped;
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='creator_hq';
-- Effective privileges include PUBLIC/inherited access, not just direct ACLs.
SELECT r.rolname,c.relname,
 has_table_privilege(r.oid,c.oid,'SELECT') AS select_rows,
 has_table_privilege(r.oid,c.oid,'INSERT') AS insert_rows,
 has_table_privilege(r.oid,c.oid,'UPDATE') AS update_rows,
 has_table_privilege(r.oid,c.oid,'DELETE') AS delete_rows,
 has_table_privilege(r.oid,c.oid,'TRUNCATE') AS truncate_rows,
 has_table_privilege(r.oid,c.oid,'REFERENCES') AS references_objects,
 has_table_privilege(r.oid,c.oid,'TRIGGER') AS create_triggers
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
WHERE n.nspname='creator_hq' AND c.relkind IN ('r','p','v','m','f')
AND r.rolname IN ('creator_hq_runtime','anon','authenticated','service_role');
SELECT r.rolname,c.relname,
 has_sequence_privilege(r.oid,c.oid,'USAGE') AS usage,
 has_sequence_privilege(r.oid,c.oid,'SELECT') AS select_value,
 has_sequence_privilege(r.oid,c.oid,'UPDATE') AS update_value
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
WHERE n.nspname='creator_hq' AND c.relkind='S'
AND r.rolname IN ('creator_hq_runtime','anon','authenticated','service_role');
SELECT r.rolname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
 has_function_privilege(r.oid,p.oid,'EXECUTE') AS execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN pg_roles r
WHERE n.nspname='creator_hq' AND r.rolname IN ('creator_hq_runtime','anon','authenticated','service_role');

-- Routine ACLs include the implicit PUBLIC EXECUTE default. Do not call them.
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,p.prokind,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,
 CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
 a.privilege_type,a.is_grantable,'BLOCKER_UNEXPECTED_ROUTINE' AS assessment
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
WHERE n.nspname='creator_hq';
SELECT t.typname,pg_get_userbyid(t.typowner) AS owner,t.typtype
FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='creator_hq';
SELECT e.extname,pg_get_userbyid(e.extowner) AS owner FROM pg_extension e
JOIN pg_namespace n ON n.oid=e.extnamespace WHERE n.nspname='creator_hq';
-- Includes other namespace-dependent objects (operators, collations, etc.).
SELECT pg_describe_object(d.classid,d.objid,d.objsubid) AS dependent_object
FROM pg_depend d JOIN pg_namespace n ON n.oid=d.refobjid
WHERE n.nspname='creator_hq' AND d.refclassid='pg_namespace'::regclass;
SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS data_type,
 a.attnotnull,pg_get_expr(def.adbin,def.adrelid) AS column_default
FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_attrdef def ON def.adrelid=a.attrelid AND def.adnum=a.attnum
WHERE n.nspname='creator_hq' AND a.attnum>0 AND NOT a.attisdropped;
SELECT c.relname,con.conname,con.contype,pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='creator_hq';
SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='creator_hq';
SELECT c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='creator_hq' AND NOT t.tgisinternal;

-- Raw explicit defaults for EVERY creator: global AND private-schema entries.
SELECT pg_get_userbyid(d.defaclrole) AS object_creator,
 CASE WHEN d.defaclnamespace=0 THEN 'GLOBAL' ELSE n.nspname END AS scope,d.defaclobjtype,
 CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
 a.privilege_type,a.is_grantable
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE d.defaclnamespace=0 OR n.nspname='creator_hq' ORDER BY object_creator,scope,d.defaclobjtype;

-- Effective GLOBAL baseline for relevant creators, including built-in defaults
-- when no catalog row exists. Schema ACLs above ADD to, never subtract from it.
WITH creators(oid) AS (
 SELECT oid FROM pg_roles WHERE rolname=current_user
 UNION SELECT defaclrole FROM pg_default_acl
 UNION SELECT nspowner FROM pg_namespace WHERE nspname='creator_hq'
 UNION SELECT c.relowner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='creator_hq'
 UNION SELECT p.proowner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='creator_hq'
), kinds(kind,label) AS (VALUES ('r','TABLES'),('S','SEQUENCES'),('f','ROUTINES'))
SELECT pg_get_userbyid(o.oid) AS object_creator,k.label,d.oid IS NULL AS built_in_default,
 CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
 a.privilege_type,a.is_grantable,
 CASE WHEN a.grantee=o.oid THEN 'OWNER' WHEN k.kind='f' THEN 'FUTURE_ROUTINE_REVIEW_REQUIRED' ELSE 'BLOCKER_GLOBAL_DEFAULT_GRANT' END AS assessment
FROM creators o CROSS JOIN kinds k LEFT JOIN pg_default_acl d
 ON d.defaclrole=o.oid AND d.defaclnamespace=0 AND d.defaclobjtype=k.kind::"char"
CROSS JOIN LATERAL aclexplode(coalesce(d.defaclacl,acldefault(k.kind::"char",o.oid))) a;

-- Unexpected ownership anywhere in this database can bypass runtime ACL/RLS.
SELECT 'RELATION' AS object_type,n.nspname,c.relname AS object_name
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE r.rolname='creator_hq_runtime'
UNION ALL SELECT 'ROUTINE',n.nspname,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE r.rolname='creator_hq_runtime'
UNION ALL SELECT 'SCHEMA',n.nspname,n.nspname FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE r.rolname='creator_hq_runtime';
SELECT d.datname AS runtime_owned_database FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE r.rolname='creator_hq_runtime';
SELECT n.nspname,t.typname AS runtime_owned_type FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
JOIN pg_roles r ON r.oid=t.typowner WHERE r.rolname='creator_hq_runtime';
COMMIT;
