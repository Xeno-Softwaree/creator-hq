-- PostgreSQL 17: pg_auth_members.roleid is the GRANTED role; member is its recipient.
-- Reject EVERY membership where runtime is the recipient (member=runtime).
-- For recipients OF runtime, allow only the measured postgres administrator's
-- automatic management grant: ADMIN TRUE, INHERIT FALSE, SET FALSE, grantor=10.
-- OID 10 is PostgreSQL's bootstrap superuser, the grantor of this automatic grant.
-- This does not grant any administrative role TO runtime. The administrator
-- remains trusted: ADMIN OPTION can manage this role and grant memberships later.
-- Missing membership-option fields fail closed. No GRANT/REVOKE of memberships.
-- Run only after operator review in the existing project. Never put a password in this file.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='creator_hq_runtime') THEN
  CREATE ROLE creator_hq_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION;
 ELSE
  RAISE NOTICE 'Existing role preserved; validating the preparation-only boundary.';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='creator_hq_runtime'
  AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolbypassrls OR rolreplication))
  OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='creator_hq_runtime'))
  OR EXISTS (SELECT 1 FROM pg_auth_members m
   JOIN pg_roles administrator ON administrator.oid=m.member
   WHERE m.roleid=(SELECT oid FROM pg_roles WHERE rolname='creator_hq_runtime')
   AND (
    administrator.rolname='postgres' AND administrator.rolcreaterole AND NOT administrator.rolsuper
    AND m.admin_option AND m.grantor=10
    AND (to_jsonb(m)->>'inherit_option')='false'
    AND (to_jsonb(m)->>'set_option')='false'
    AND current_setting('server_version_num')::integer>=170000
   ) IS NOT TRUE) THEN
  RAISE EXCEPTION 'RUNTIME_ROLE_REVIEW_REQUIRED';
 END IF;
END $$;
-- No password or LOGIN change is authorized by this preparation script.
-- Inspect existing role settings/ownership/grants with inspect-security.sql.
-- No role is granted membership in postgres or any Supabase privileged role.
