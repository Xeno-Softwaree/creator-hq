import {NATIVE_EXECUTION_RELEASE_APPROVED} from './execution/release.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { db as defaultDb, databaseProvider } from './db.js';
import { simulationReport, completionReport } from './reports.js';
import { integrations } from './integrations.js';
import {databaseErrorCode,isDatabaseUnavailable} from './database/errors.js';
import {createHealthProbe,healthBudgetMs} from './database/health.js';
import {agentIds,agentPolicy,executionDraftSchema,makeContract,contractDigest,jobStatuses,routeAssignment,studioSchema} from './execution/contract.js';
import {containsSecret,codexPlan} from './execution/adapter.js';
import {ExecutionJobs,lockExecutionChanges,invalidateTaskApprovals,type JobDatabase,type JobLauncher,type Sql} from './execution/jobs.js';
import {NativeCodexLauncher} from './execution/launcher.js';
import {executionRoutes} from './execution/routes.js';
import {loadRuntimeSettings} from './execution/windows-host.js';
const studio = z.enum(['HQ','Niko','Son Yedek']);
const taskSchema = z.object({title:z.string().trim().min(1).max(160),description:z.string().max(5000).default(''),studio,agentId:z.string().min(1),status:z.enum(['Backlog','In progress','Review','Done']).default('Backlog')});
export async function buildApp(options:{database?:typeof defaultDb;provider?:'sqlite'|'postgresql';healthTimeoutMs?:number;executionLauncher?:JobLauncher;ownerPasswordHash?:string}={}) {
 const db=options.database??defaultDb;
 const app = Fastify({logger:process.env.NODE_ENV==='test'?false:{redact:['req.headers.authorization','req.headers.cookie']},bodyLimit:32768});
 await app.register(cors,{origin:['http://127.0.0.1:3000','http://localhost:3000'],credentials:true,methods:['GET','POST','PATCH','DELETE']});
 app.addHook('onRequest',async(req,reply)=>{if(req.headers.origin && !['http://127.0.0.1:3000','http://localhost:3000'].includes(req.headers.origin)) return reply.code(403).send({error:'Origin not allowed',code:'ORIGIN_NOT_ALLOWED'});});
 app.setErrorHandler((err,req,reply)=>{if(err instanceof z.ZodError) return reply.code(400).send({error:err.issues.map(i=>i.message).join('; '),code:'VALIDATION_ERROR',issues:err.issues.map(i=>({path:i.path,code:i.code}))}); const e=err as {code?:string;statusCode?:number}; if(e.code==='P2025') return reply.code(404).send({error:'Record not found',code:'RECORD_NOT_FOUND'});if(isDatabaseUnavailable(err))return reply.code(503).send({error:'Database unavailable',code:'DATABASE_UNAVAILABLE'});req.log.error({code:databaseErrorCode(err)??'INTERNAL_ERROR'},'Request failed');return reply.code(e.statusCode??500).send({error:e.statusCode===400?'Invalid request':'Internal error',code:e.statusCode===400?'INVALID_REQUEST':'INTERNAL_ERROR'});});
 const probeHealth=createHealthProbe(async()=>{if(typeof db.$connect==='function')await db.$connect();await db.$queryRaw`SELECT 1`},options.healthTimeoutMs??healthBudgetMs(process.env));
 app.get('/health',async(req,reply)=>{try{await probeHealth();return {status:'ok',execution:NATIVE_EXECUTION_RELEASE_APPROVED?'atlas_text_release':'disabled',database:options.provider??databaseProvider}}catch(error){if(isDatabaseUnavailable(error)||(error as {code?:string})?.code==='HEALTH_TIMEOUT')return reply.code(503).send({status:'unavailable',execution:'disabled',code:'DATABASE_UNAVAILABLE'});throw error}});
 app.addHook('preHandler',async(req,reply)=>{if(process.env.DATABASE_READ_ONLY==='true'&&['POST','PATCH','PUT','DELETE'].includes(req.method))return reply.code(503).send({error:'Migration read-only mode',code:'MIGRATION_READ_ONLY'})});
 // Prisma 6 query wrapping drops initialization errorCode; explicit connect preserves it.
 // Never retry the request or queue a failed write when connectivity is restored.
 app.addHook('preHandler',async(req)=>{if(req.routeOptions.url!=='/health'&&typeof db.$connect==='function')await db.$connect()});
 app.get('/state',async()=>({agents:await db.agent.findMany({orderBy:{id:'asc'}}),tasks:await db.task.findMany({orderBy:{createdAt:'desc'}}),activity:await db.activity.findMany({orderBy:{createdAt:'desc'},take:100}),approvals:await db.approval.findMany({orderBy:{createdAt:'desc'}}),integrations,studioSettings:await db.studioSettings.findMany({orderBy:{id:'asc'}}),reports:await db.agentReport.findMany({orderBy:{createdAt:'desc'},take:100})}));
 // Preview only: no approval creation, job persistence, process launch or change to ExecutionJob.enabled.
 app.get('/execution/policies',async()=>({version:1,enabled:false,source:'preview',statuses:jobStatuses,profiles:agentIds.map(agentPolicy)}));
 app.post('/execution/route',async(req,reply)=>{
  const parsed=z.object({intent:z.enum(['coordinate','research','script','edit','design','analyze','lead']),studio:studioSchema}).strict().safeParse(req.body);
  if(!parsed.success)return reply.code(400).send({code:'EXECUTION_INPUT_INVALID'});
  const input=parsed.data;
  try{return {source:'preview',...routeAssignment(input.intent,input.studio)}}catch{return reply.code(400).send({code:'EXECUTION_SCOPE_INVALID'})}
 });
 app.post('/execution/preview',async(req,reply)=>{
  const parsed=executionDraftSchema.safeParse(req.body);if(!parsed.success)return reply.code(400).send({code:'EXECUTION_INPUT_INVALID'});
  const draft=parsed.data,agent=await db.agent.findUnique({where:{id:draft.agentId}});
  if(!agent||!agent.enabled)return reply.code(409).send({code:'EXECUTION_PROFILE_UNAVAILABLE'});
  const policy=agentPolicy(draft.agentId);
  if(!policy.executable||agent.studio!==policy.studio||policy.studio!=='HQ'&&policy.studio!==draft.studio)return reply.code(400).send({code:'EXECUTION_SCOPE_INVALID'});
  if(draft.taskId){const current=await db.task.findUnique({where:{id:draft.taskId}});if(!current||current.title!==draft.title||current.description!==draft.description||current.agentId!==draft.agentId||current.studio!==draft.studio)return reply.code(409).send({code:'EXECUTION_TASK_CHANGED'});}
  if(containsSecret(JSON.stringify(draft))||containsSecret(agent.instructions))return reply.code(400).send({code:'EXECUTION_INPUT_REJECTED'});
  const contract=makeContract(draft,agent.instructions),plan=codexPlan(contract);
  return {source:'preview',enabled:false,status:'planned',contract,digest:contractDigest(contract),approval:{status:'not_requested',requiredActor:'human_owner',valid:false},blockedBy:plan.blockedBy};
 });
 const checkAgent=async(id:string,s:string,target:Pick<typeof db,'agent'>)=>{const a=await target.agent.findUnique({where:{id}});return a && (a.studio==='HQ'||a.studio===s)};
 app.post('/tasks',async(req,reply)=>{
  const data=taskSchema.parse(req.body);
  const task=await db.$transaction(async tx=>{
   if(!await checkAgent(data.agentId,data.studio,tx))return null;
   const created=await tx.task.create({data});
   await tx.activity.create({data:{agentId:data.agentId,message:`Task created: ${data.title}`}});
   return created;
  },{maxWait:5000,timeout:20000});
  if(!task)return reply.code(400).send({error:'Choose an agent in the selected studio or HQ',code:'STUDIO_AGENT_MISMATCH'});
  return reply.code(201).send(task);
 });
 app.patch('/tasks/:id',async(req,reply)=>{
  const {id}=req.params as {id:string};
  const outcome=await db.$transaction(async tx=>{
   if((options.provider??databaseProvider)==='postgresql')await lockExecutionChanges(tx as unknown as Sql);
   if((options.provider??databaseProvider)==='postgresql')await tx.$queryRaw`SELECT id FROM creator_hq."Task" WHERE id=${id} FOR UPDATE`;
   const old=await tx.task.findUnique({where:{id}});
   if(!old)return {error:'TASK_NOT_FOUND' as const};
   const data=taskSchema.parse({...old,...z.object({title:taskSchema.shape.title.optional(),description:z.string().max(5000).optional(),studio:studio.optional(),agentId:z.string().min(1).optional(),status:z.enum(['Backlog','In progress','Review','Done']).optional()}).parse(req.body)});
   if(!await checkAgent(data.agentId,data.studio,tx))return {error:'STUDIO_AGENT_MISMATCH' as const};
   const task=await tx.task.update({where:{id},data});
   if((options.provider??databaseProvider)==='postgresql'&&['title','description','studio','agentId'].some(key=>(old as any)[key]!==(task as any)[key]))await invalidateTaskApprovals(tx as unknown as Sql,'taskId',id);
   if(old.status!=='Done'&&task.status==='Done')await tx.agentReport.create({data:completionReport(task)});
   return {task};
  },{maxWait:5000,timeout:20000});
  if(outcome.error==='TASK_NOT_FOUND')return reply.code(404).send({error:'Task not found',code:outcome.error});
  if(outcome.error)return reply.code(400).send({error:'Agent does not belong to this studio',code:outcome.error});
  return outcome.task;
 });
 app.delete('/tasks/:id',async(req,reply)=>{await db.task.delete({where:{id:(req.params as {id:string}).id}});return reply.code(204).send()});
 app.patch('/agents/:id',async(req)=>{const data=z.object({name:z.string().trim().min(1).max(60),role:z.string().trim().min(1).max(100),instructions:z.string().max(5000),enabled:z.boolean()}).parse(req.body);const id=(req.params as {id:string}).id;return db.$transaction(async tx=>{if((options.provider??databaseProvider)==='postgresql')await lockExecutionChanges(tx as unknown as Sql);const old=await tx.agent.findUnique({where:{id}});const updated=await tx.agent.update({where:{id},data});if((options.provider??databaseProvider)==='postgresql'&&old&&['role','instructions','enabled'].some(key=>(old as any)[key]!==(updated as any)[key]))await invalidateTaskApprovals(tx as unknown as Sql,'agentId',id);return updated})});
 app.post('/simulate',async(req,reply)=>{const agent=await db.agent.findFirst({where:{enabled:true,id:{not:'ceo'}}});if(!agent)return reply.code(409).send({error:'No enabled agents',code:'NO_ENABLED_AGENTS'});return db.$transaction(async tx=>{const activity=await tx.activity.create({data:{agentId:agent.id,message:'SIMULATED: prepared a sample concept for human review. No process executed.',simulated:true}});const approval=await tx.approval.create({data:{agentId:agent.id,title:'SIMULATED: sample concept review'}});await tx.agentReport.create({data:simulationReport(agent.id,activity.id,approval.id)});return approval})});
 app.patch('/approvals/:id',async(req,reply)=>{if((req.params as {id:string}).id.startsWith('execution:'))return reply.code(403).send({code:'EXECUTION_APPROVAL_ROUTE_REQUIRED'});const {status}=z.object({status:z.enum(['Approved','Rejected'])}).parse(req.body);const result=await db.$transaction(async tx=>{const result=await tx.approval.updateMany({where:{id:(req.params as {id:string}).id,status:'Pending'},data:{status}});if(result.count)await tx.agentReport.updateMany({where:{approvalId:(req.params as {id:string}).id},data:{status:status==='Approved'?'completed':'blocked'}});return result});if(!result.count)return reply.code(409).send({error:'Approval missing or already decided',code:'APPROVAL_CONFLICT'});return {status,execution:'disabled'}});
 app.patch('/studios/:id',async(req,reply)=>{const {id}=z.object({id:z.enum(['Niko','Son Yedek'])}).parse(req.params);const {contentLanguage}=z.object({contentLanguage:z.enum(['tr-TR','en-US'])}).parse(req.body);return db.studioSettings.upsert({where:{id},update:{contentLanguage},create:{id,contentLanguage}})});
 const jobs=(options.provider??databaseProvider)==='postgresql'?new ExecutionJobs(db as unknown as JobDatabase,options.executionLauncher??new NativeCodexLauncher(loadRuntimeSettings(process.env.CREATOR_CODEX_RUNTIME_FILE))):null;
 await executionRoutes(app,jobs,options.ownerPasswordHash??process.env.CREATOR_OWNER_PASSWORD_HASH);
 app.addHook('onClose',async()=>{await db.$disconnect()});return app;
}
