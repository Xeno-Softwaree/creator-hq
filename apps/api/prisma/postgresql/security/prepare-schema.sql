-- PostgreSQL 17: pg_auth_members.roleid is the GRANTED role; member is its recipient.
-- Reject EVERY membership where runtime is the recipient (member=runtime).
-- For recipients OF runtime, allow only the measured postgres administrator's
-- automatic management grant: ADMIN TRUE, INHERIT FALSE, SET FALSE, grantor=10.
-- OID 10 is PostgreSQL's bootstrap superuser, the grantor of this automatic grant.
-- This does not grant any administrative role TO runtime. The administrator
-- remains trusted: ADMIN OPTION can manage this role and grant memberships later.
-- Missing membership-option fields fail closed. No GRANT/REVOKE of memberships.
-- Preparation only. Review and obtain explicit approval before live execution.
-- Run as the same administrative owner that will run Prisma migrate deploy.
-- This creates no application tables and does not enable LOGIN or set passwords.
BEGIN;
DO $$ BEGIN
 IF current_user = 'creator_hq_runtime' THEN
  RAISE EXCEPTION 'ADMINISTRATIVE_OWNER_REQUIRED';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='creator_hq_runtime') THEN
  RAISE EXCEPTION 'CREATOR_HQ_RUNTIME_ROLE_REQUIRED';
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
  RAISE EXCEPTION 'UNSAFE_RUNTIME_ROLE';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname='creator_hq_runtime'
   AND has_database_privilege(r.oid,current_database(),'CREATE'))
   OR EXISTS (SELECT 1 FROM pg_namespace n CROSS JOIN pg_roles r WHERE r.rolname='creator_hq_runtime'
    AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND has_schema_privilege(r.oid,n.oid,'CREATE'))
   OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE r.rolname='creator_hq_runtime')
   OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE r.rolname='creator_hq_runtime')
   OR EXISTS (SELECT 1 FROM pg_type t JOIN pg_roles r ON r.oid=t.typowner WHERE r.rolname='creator_hq_runtime') THEN
  RAISE EXCEPTION 'RUNTIME_OWNERSHIP_OR_DDL_REVIEW_REQUIRED';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='creator_hq' AND nspowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)) THEN
  RAISE EXCEPTION 'SCHEMA_OWNER_REVIEW_REQUIRED';
 END IF;
 -- Never adopt or repair an existing populated schema implicitly, even if empty tables
 -- or only Prisma history exist. Inspect owners/ACLs/data first; plan separately.
 IF EXISTS (SELECT 1 FROM pg_depend d JOIN pg_namespace n ON n.oid=d.refobjid
   WHERE n.nspname='creator_hq' AND d.refclassid='pg_namespace'::regclass
   AND d.classid<>'pg_default_acl'::regclass)
   OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='creator_hq')
   OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='creator_hq') THEN
  RAISE EXCEPTION 'EXISTING_SCHEMA_OBJECTS_REVIEW_REQUIRED';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
   WHERE n.nspname='creator_hq' AND a.grantee<>n.nspowner
   AND NOT (a.grantee=(SELECT oid FROM pg_roles WHERE rolname='creator_hq_runtime') AND a.privilege_type='USAGE' AND NOT a.is_grantable)) THEN
  RAISE EXCEPTION 'EXISTING_SCHEMA_ACL_REVIEW_REQUIRED';
 END IF;
 -- Per-schema REVOKE cannot subtract global defaults. Do not change shared
 -- Supabase owner defaults or revoke system-role rights: fail for manual review.
 IF EXISTS (SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname=current_user)
   AND d.defaclnamespace=0 AND d.defaclobjtype IN ('r','S','n') AND a.grantee<>d.defaclrole) THEN
  RAISE EXCEPTION 'GLOBAL_DEFAULT_ACL_REVIEW_REQUIRED';
 END IF;
 IF EXISTS (SELECT 1 FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace
   CROSS JOIN LATERAL aclexplode(d.defaclacl) a
   WHERE n.nspname='creator_hq' AND a.grantee<>d.defaclrole) THEN
  RAISE EXCEPTION 'SCHEMA_DEFAULT_ACL_REVIEW_REQUIRED';
 END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS creator_hq;
REVOKE ALL ON SCHEMA creator_hq FROM PUBLIC;
REVOKE ALL ON SCHEMA creator_hq FROM creator_hq_runtime;
GRANT USAGE ON SCHEMA creator_hq TO creator_hq_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA creator_hq REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA creator_hq REVOKE ALL ON TABLES FROM creator_hq_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA creator_hq REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA creator_hq REVOKE ALL ON SEQUENCES FROM creator_hq_runtime;
-- PostgreSQL grants PUBLIC EXECUTE globally to new routines by default.
-- No functions/procedures are created here or by the current Prisma migration.
-- A per-schema routine REVOKE would NOT remove that global default. Future
-- routines require a separately reviewed, object-specific revoke in the same
-- creation transaction (or a separately approved dedicated owner policy).
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA creator_hq FROM %I',role_name);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA creator_hq REVOKE ALL ON TABLES FROM %I',role_name);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA creator_hq REVOKE ALL ON SEQUENCES FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
COMMIT;
-- Defaults apply only to objects created by this owner, not every database role.
-- No global default privileges, service_role or system-role attributes/memberships
-- are changed. Current objects cause a stop instead of blanket privilege repair.
-- Application table grants/RLS belong to the reviewed Prisma migration.
