-- READ ONLY. Review/approve live execution separately. Only aggregate counts
-- are emitted as NOTICE, never record contents. Use a trusted administrative
-- inspector. SQL Editor/psql must display NOTICE output; absence is not zero.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
-- Fail rather than silently count a filtered RLS subset. This does NOT grant
-- BYPASSRLS; an inspector without sufficient rights receives COUNT_UNVERIFIED.
SET LOCAL row_security = off;
DO $$ DECLARE item record; records bigint; BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='creator_hq') THEN
  RAISE NOTICE 'SCHEMA_ABSENT';
 END IF;
 FOR item IN SELECT c.relname,c.relkind FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='creator_hq' AND c.relkind IN ('r','p','v','m','f') ORDER BY c.relname LOOP
  IF item.relkind NOT IN ('r','p') THEN
   RAISE NOTICE 'COUNT_UNVERIFIED_NON_BASE_RELATION: %',item.relname;
   CONTINUE;
  END IF;
  BEGIN
   EXECUTE format('SELECT count(*) FROM ONLY %I.%I','creator_hq',item.relname) INTO records;
   RAISE NOTICE 'EXACT_VISIBLE_COUNT: % = %',item.relname,records;
   IF records>0 THEN RAISE NOTICE 'BLOCKER_EXISTING_DATA_REVIEW_REQUIRED: %',item.relname; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
   RAISE NOTICE 'COUNT_UNVERIFIED_PRIVILEGE_OR_RLS: %',item.relname;
  END;
 END LOOP;
END $$;
-- Timeout/lock/other failures abort: do not interpret incomplete output as safe.
-- Counts are per physical relation using ONLY, not a database-wide total.
-- Partition parents normally report zero; their local partitions are separate
-- relations above. ONLY avoids traversing foreign/inherited child relations.
COMMIT;
