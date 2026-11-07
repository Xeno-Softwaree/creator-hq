-- REVIEW ONLY. Stop the owned worker before rollback. Never rewrite historical records.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '20s';
LOCK TABLE creator_hq."ExecutionJob" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
 IF current_user <> 'postgres' OR NOT EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='creator_hq' AND c.relname='ExecutionJob'
  AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)
 ) THEN RAISE EXCEPTION 'ATLAS_ROLLBACK_OWNER_REVIEW_REQUIRED'; END IF;
 IF EXISTS (SELECT 1 FROM creator_hq."ExecutionJob" WHERE enabled OR status='running')
 THEN RAISE EXCEPTION 'ATLAS_ROLLBACK_ACTIVE_JOB_REVIEW_REQUIRED'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='creator_hq."ExecutionJob"'::regclass AND conname='ExecutionJob_atlas_text_check')
 THEN RAISE EXCEPTION 'ATLAS_ROLLBACK_CONSTRAINT_REVIEW_REQUIRED'; END IF;
END $$;
ALTER TABLE creator_hq."ExecutionJob" ADD CONSTRAINT "ExecutionJob_disabled_check" CHECK (enabled=false);
ALTER TABLE creator_hq."ExecutionJob" DROP CONSTRAINT "ExecutionJob_atlas_text_check";
DROP INDEX creator_hq."ExecutionJob_single_running_idx";
COMMIT;
