-- REVIEW ONLY. Not a Prisma-discovered migration. Never execute without separate approval.
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
 ) THEN RAISE EXCEPTION 'ATLAS_MIGRATION_OWNER_REVIEW_REQUIRED'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conrelid='creator_hq."ExecutionJob"'::regclass
  AND conname='ExecutionJob_disabled_check' AND convalidated
  AND regexp_replace(pg_get_constraintdef(oid),'[[:space:]()]','','g')='CHECKenabled=false'
 ) THEN RAISE EXCEPTION 'ATLAS_DISABLED_CONSTRAINT_REVIEW_REQUIRED'; END IF;
 IF EXISTS (SELECT 1 FROM creator_hq."ExecutionJob" WHERE enabled OR status='running')
 THEN RAISE EXCEPTION 'ATLAS_EXISTING_JOB_REVIEW_REQUIRED'; END IF;
END $$;
ALTER TABLE creator_hq."ExecutionJob" ADD CONSTRAINT "ExecutionJob_atlas_text_check" CHECK (
 NOT enabled OR COALESCE(
  "agentId"='director' AND status='running'
  AND metadata->'version'='2'::jsonb AND metadata->>'source'='codex'
  AND metadata->>'approvalId'='execution:' || id
  AND metadata->>'digest' ~ '^[a-f0-9]{64}$'
  AND metadata#>>'{approval,actor}'='owner'
  AND metadata#>>'{approval,digest}'=metadata->>'digest'
  AND jsonb_typeof(metadata#>'{approval,sessionAudit}')='string'
  AND metadata#>>'{worker,token}' ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
  AND jsonb_typeof(metadata#>'{worker,leaseUntil}')='string'
  AND metadata#>'{contract,version}'='1'::jsonb
  AND metadata#>>'{contract,task,agentId}'='director'
  AND metadata#>>'{contract,task,taskId}'="taskId"
  AND metadata#>>'{contract,scope,studio}'=metadata#>>'{contract,task,studio}'
  AND metadata#>>'{contract,scope,context}'='provided_text_only'
  AND metadata#>>'{contract,scope,session}'='fresh_job_only'
  AND metadata#>'{contract,permissions}'='{"tools":["text"],"filesystem":"none","network":"none","database":"none","publishing":false,"mcp":false,"hooks":false}'::jsonb
 ,false)
);
CREATE UNIQUE INDEX "ExecutionJob_single_running_idx" ON creator_hq."ExecutionJob" (status) WHERE status='running';
ALTER TABLE creator_hq."ExecutionJob" DROP CONSTRAINT "ExecutionJob_disabled_check";
COMMIT;
