-- READ ONLY. Run only after separately approved credential/login setup.
-- Prefer a new psql connection authenticated AS runtime, not SET ROLE in SQL Editor.
-- Does not read application rows, passwords, verifiers or connection URLs.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
SELECT current_database() AS database_name,current_user AS effective_role,
 session_user AS authenticated_role,current_setting('transaction_read_only') AS read_only,
 current_user='creator_hq_runtime' AND session_user='creator_hq_runtime' AS runtime_credential_session;
-- \\conninfo in psql verifies the client connection context. pg_stat_ssl on
-- a pooled backend is NOT proof of TLS on the client-to-pooler hop.
SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls,rolreplication
FROM pg_roles WHERE rolname='creator_hq_runtime';
SELECT parent.rolname AS granted_role,recipient.rolname AS recipient,
 m.grantor AS grantor_oid,m.admin_option,m.inherit_option,m.set_option,
 CASE WHEN recipient.rolname='creator_hq_runtime' THEN 'BLOCKER_RUNTIME_IS_MEMBER'
 WHEN recipient.rolname='postgres' AND recipient.rolcreaterole AND NOT recipient.rolsuper
 AND m.grantor=10 AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option
 THEN 'EXPECTED_ADMINISTRATION' ELSE 'BLOCKER_UNEXPECTED_RECIPIENT' END AS assessment
FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid
JOIN pg_roles recipient ON recipient.oid=m.member
WHERE parent.rolname='creator_hq_runtime' OR recipient.rolname='creator_hq_runtime';
SELECT r.rolname,has_database_privilege(r.oid,current_database(),'CONNECT') AS connect,
 has_database_privilege(r.oid,current_database(),'CREATE') AS database_create
FROM pg_roles r WHERE r.rolname='creator_hq_runtime';
SELECT n.nspname,pg_get_userbyid(n.nspowner) AS owner,
 has_schema_privilege(r.oid,n.oid,'USAGE') AS runtime_usage,
 has_schema_privilege(r.oid,n.oid,'CREATE') AS runtime_create
FROM pg_namespace n CROSS JOIN pg_roles r
WHERE n.nspname='creator_hq' AND r.rolname='creator_hq_runtime';
SELECT c.relname,c.relkind,pg_get_userbyid(c.relowner) AS owner,
 c.relrowsecurity,c.relforcerowsecurity,
 has_table_privilege(r.oid,c.oid,'SELECT') AS select_rows,
 has_table_privilege(r.oid,c.oid,'INSERT') AS insert_rows,
 has_table_privilege(r.oid,c.oid,'UPDATE') AS update_rows,
 has_table_privilege(r.oid,c.oid,'DELETE') AS delete_rows,
 has_table_privilege(r.oid,c.oid,'TRUNCATE') AS truncate_rows
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
WHERE n.nspname='creator_hq' AND c.relkind IN ('r','p','v','m','f')
AND r.rolname='creator_hq_runtime' ORDER BY c.relname;
SELECT count(*) AS table_like_relation_count,
 CASE WHEN count(*)=0 THEN 'NOT_TESTED_NO_TABLES'
 ELSE 'REVIEW_TABLE_PRIVILEGES_AND_RLS' END AS table_permission_status
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='creator_hq' AND c.relkind IN ('r','p','v','m','f');
COMMIT;
