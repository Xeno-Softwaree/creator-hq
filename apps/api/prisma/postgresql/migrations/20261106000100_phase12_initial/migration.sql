-- Reviewed additive migration: only the private Creator HQ schema is created.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='creator_hq_runtime') THEN
  RAISE EXCEPTION 'CREATOR_HQ_RUNTIME_ROLE_REQUIRED';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='creator_hq_runtime' AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication)) OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='creator_hq_runtime')) THEN
  RAISE EXCEPTION 'UNSAFE_RUNTIME_ROLE';
 END IF;
END $$;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "creator_hq";
-- Constrain every generated unqualified object to the private schema.
SET LOCAL search_path TO creator_hq, pg_catalog;

-- CreateTable
CREATE TABLE "Studio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "studio" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "studio" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Backlog',
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "agentId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "simulated" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioSettings" (
    "id" TEXT NOT NULL,
    "contentLanguage" TEXT NOT NULL,

    CONSTRAINT "StudioSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentReport" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "taskId" TEXT,
    "approvalId" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summaryData" TEXT NOT NULL,
    "originalTechnicalReport" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationSetting" (
    "id" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ApplicationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtifactReference" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "storageRoot" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "mediaType" TEXT,
    "sha256" CHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtifactReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionJob" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ExecutionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Agent_studio_idx" ON "Agent"("studio");

-- CreateIndex
CREATE INDEX "Task_studio_status_idx" ON "Task"("studio", "status");

-- CreateIndex
CREATE INDEX "Task_agentId_createdAt_idx" ON "Task"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_agentId_createdAt_idx" ON "Activity"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_status_createdAt_idx" ON "Approval"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Approval_agentId_idx" ON "Approval"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentReport_sourceId_key" ON "AgentReport"("sourceId");

-- CreateIndex
CREATE INDEX "AgentReport_agentId_createdAt_idx" ON "AgentReport"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentReport_taskId_idx" ON "AgentReport"("taskId");

-- CreateIndex
CREATE INDEX "AgentReport_approvalId_idx" ON "AgentReport"("approvalId");

-- CreateIndex
CREATE INDEX "ArtifactReference_taskId_idx" ON "ArtifactReference"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtifactReference_storageRoot_relativePath_key" ON "ArtifactReference"("storageRoot", "relativePath");

-- CreateIndex
CREATE INDEX "ExecutionJob_status_createdAt_idx" ON "ExecutionJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionJob_taskId_idx" ON "ExecutionJob"("taskId");

-- CreateIndex
CREATE INDEX "ExecutionJob_agentId_idx" ON "ExecutionJob"("agentId");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_studio_fkey" FOREIGN KEY ("studio") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_studio_fkey" FOREIGN KEY ("studio") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "StudioSettings" ADD CONSTRAINT "StudioSettings_id_fkey" FOREIGN KEY ("id") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AgentReport" ADD CONSTRAINT "AgentReport_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AgentReport" ADD CONSTRAINT "AgentReport_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AgentReport" ADD CONSTRAINT "AgentReport_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ArtifactReference" ADD CONSTRAINT "ArtifactReference_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ExecutionJob" ADD CONSTRAINT "ExecutionJob_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ExecutionJob" ADD CONSTRAINT "ExecutionJob_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- String identifiers preserve the existing API contract while checks enforce valid states.
ALTER TABLE creator_hq."Task" ADD CONSTRAINT "Task_status_check" CHECK (status IN ('Backlog','In progress','Review','Done'));
ALTER TABLE creator_hq."Task" ADD CONSTRAINT "Task_priority_check" CHECK (priority IN ('Low','Normal','High','Urgent'));
ALTER TABLE creator_hq."Approval" ADD CONSTRAINT "Approval_status_check" CHECK (status IN ('Pending','Approved','Rejected'));
ALTER TABLE creator_hq."AgentReport" ADD CONSTRAINT "AgentReport_status_check" CHECK (status IN ('completed','awaiting_approval','blocked','failed','partial'));
ALTER TABLE creator_hq."StudioSettings" ADD CONSTRAINT "StudioSettings_language_check" CHECK ("contentLanguage" IN ('tr-TR','en-US'));
ALTER TABLE creator_hq."ExecutionJob" ADD CONSTRAINT "ExecutionJob_disabled_check" CHECK (enabled = false);
ALTER TABLE creator_hq."ExecutionJob" ADD CONSTRAINT "ExecutionJob_status_check" CHECK (status IN ('planned','awaiting_approval','running','completed','failed','cancelled'));
ALTER TABLE creator_hq."ArtifactReference" ADD CONSTRAINT "ArtifactReference_local_check" CHECK (
 "storageRoot" IN ('app','vaults','media','backups') AND length("relativePath") > 0
 AND "relativePath" !~ '^[/\\]' AND "relativePath" !~ '^[A-Za-z]:'
 AND "relativePath" !~ '(^|/)\.\.(/|$)' AND position(chr(92) in "relativePath")=0
);
INSERT INTO creator_hq."Studio" (id,name) VALUES ('HQ','Headquarters'),('Niko','Afterlight Stories / Niko'),('Son Yedek','Son Yedek');
REVOKE ALL ON SCHEMA creator_hq FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA creator_hq FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA creator_hq REVOKE ALL ON TABLES FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA creator_hq FROM %I',role_name);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA creator_hq FROM %I',role_name);
   EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA creator_hq REVOKE ALL ON TABLES FROM %I',role_name);
  END IF;
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA creator_hq TO creator_hq_runtime;
-- Explicit application tables only: Prisma's migration history is administrative.
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE
 creator_hq."Studio", creator_hq."Agent", creator_hq."Task", creator_hq."Activity",
 creator_hq."Approval", creator_hq."StudioSettings", creator_hq."AgentReport",
 creator_hq."ApplicationSetting", creator_hq."ArtifactReference", creator_hq."ExecutionJob"
 TO creator_hq_runtime;
ALTER TABLE creator_hq."Studio" ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON creator_hq."Studio" TO creator_hq_runtime USING (true) WITH CHECK (true);
ALTER TABLE creator_hq."Agent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON creator_hq."Agent" TO creator_hq_runtime USING (true) WITH CHECK (true);
ALTER TABLE creator_hq."Task" ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON creator_hq."Task" TO creator_hq_runtime USING (true) WITH CHECK (true);
ALTER TABLE creator_hq."Activity" ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON creator_hq."Activity" TO creator_hq_runtime USING (true) WITH CHECK (true);
ALTER TABLE creator_hq."Approval" ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON creator_hq."Approval" TO creator_hq_runtime USING (true) WITH CHECK (true);
ALTER TABLE creator_hq."StudioSettings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON creator_hq."StudioSettings" TO creator_hq_runtime USING (true) WITH CHECK (true);
ALTER TABLE creator_hq."AgentReport" ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON creator_hq."AgentReport" TO creator_hq_runtime USING (true) WITH CHECK (true);
ALTER TABLE creator_hq."ApplicationSetting" ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON creator_hq."ApplicationSetting" TO creator_hq_runtime USING (true) WITH CHECK (true);
ALTER TABLE creator_hq."ArtifactReference" ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON creator_hq."ArtifactReference" TO creator_hq_runtime USING (true) WITH CHECK (true);
ALTER TABLE creator_hq."ExecutionJob" ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_access ON creator_hq."ExecutionJob" TO creator_hq_runtime USING (true) WITH CHECK (true);
COMMIT;
