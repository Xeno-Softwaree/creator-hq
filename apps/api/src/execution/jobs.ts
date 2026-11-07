import {NATIVE_EXECUTION_RELEASE_APPROVED,permitsNativeJob} from './release.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {makeContract,contractSchema,contractDigest,type ExecutionContract} from './contract.js';
import {containsSecret,resultSchema,type ExecutionResult} from './adapter.js';
import type {Owner} from './owner.js';
import {isReviewedFakeLauncher,isReviewedNativeLauncher} from './launcher.js';
export interface Sql { $queryRawUnsafe<T=unknown>(sql:string,...args:any[]):Promise<T>; $executeRawUnsafe(sql:string,...args:any[]):Promise<number> }
export interface JobDatabase extends Sql {$transaction<T>(fn:(tx:Sql)=>Promise<T>,options?:{maxWait:number;timeout:number}):Promise<T>}
const metaSchema=z.object({version:z.literal(2),source:z.enum(['codex','simulation']),contract:contractSchema,digest:z.string(),approvalId:z.string(),approval:z.object({actor:z.literal('owner'),sessionAudit:z.string(),digest:z.string(),expiresAt:z.string().datetime(),decidedAt:z.string().datetime()}).nullable(),worker:z.object({token:z.string().uuid(),leaseUntil:z.string().datetime(),startedAt:z.string().datetime()}).nullable(),cancelRequested:z.boolean(),result:resultSchema.nullable(),error:z.string().regex(/^[A-Z_]+$/).nullable()}).strict();
type Metadata=z.infer<typeof metaSchema>;
type Job={id:string;taskId:string;agentId:string;status:string;enabled:boolean;metadata:Metadata;createdAt:Date;updatedAt:Date};
type Snapshot={id:string;title:string;description:string;studio:'HQ'|'Niko'|'Son Yedek';agentId:string;instructions:string;agentEnabled:boolean;agentStudio:string};
export class JobFailure extends Error {constructor(readonly code:string,readonly status=409){super(code)}}
const failure=(code:string,status=409):never=>{throw new JobFailure(code,status)};
const options={maxWait:5000,timeout:20000};
export async function lockExecutionChanges(tx:Sql){await mutex(tx);}
export async function invalidateTaskApprovals(tx:Sql,field:'taskId'|'agentId',id:string){
 const query=field==='taskId'?'SELECT id FROM creator_hq."ExecutionJob" WHERE "taskId"=$1 AND metadata->>\'version\'=\'2\' AND status IN (\'awaiting_approval\',\'planned\',\'running\') FOR UPDATE':'SELECT id FROM creator_hq."ExecutionJob" WHERE "agentId"=$1 AND metadata->>\'version\'=\'2\' AND status IN (\'awaiting_approval\',\'planned\',\'running\') FOR UPDATE';
 const rows=await tx.$queryRawUnsafe<{id:string}[]>(query,id);
 for(const row of rows){const j=await readJob(tx,row.id);j.metadata.cancelRequested=true;j.metadata.error='EXECUTION_APPROVAL_STALE';if(j.status!=='running')j.status='cancelled';await tx.$executeRawUnsafe('UPDATE creator_hq."Approval" SET status=\'Rejected\' WHERE id=$1',j.metadata.approvalId);await save(tx,j);}
}
async function mutex(tx:Sql){await tx.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(8242020,4)');}
async function now(tx:Sql){return (await tx.$queryRawUnsafe<{now:Date}[]>('SELECT CURRENT_TIMESTAMP AS now'))[0].now;}
async function readJob(tx:Sql,id:string,lock=false):Promise<Job>{const rows=await tx.$queryRawUnsafe<any[]>(lock?'SELECT * FROM creator_hq."ExecutionJob" WHERE id=$1 FOR UPDATE':'SELECT * FROM creator_hq."ExecutionJob" WHERE id=$1',id);if(!rows[0])failure('EXECUTION_JOB_NOT_FOUND',404);const parsed=metaSchema.safeParse(rows[0].metadata);if(!parsed.success)failure('EXECUTION_METADATA_INVALID',500);return {...rows[0],metadata:parsed.data};}
async function snapshot(tx:Sql,taskId:string,lock=false){
 if(lock){await tx.$queryRawUnsafe('SELECT id FROM creator_hq."Task" WHERE id=$1 FOR UPDATE',taskId);await tx.$queryRawUnsafe('SELECT a.id FROM creator_hq."Agent" a JOIN creator_hq."Task" t ON t."agentId"=a.id WHERE t.id=$1 FOR UPDATE OF a',taskId);}
 const [s]=await tx.$queryRawUnsafe<Snapshot[]>('SELECT t.id,t.title,t.description,t.studio,t."agentId",a.instructions,a.enabled AS "agentEnabled",a.studio AS "agentStudio" FROM creator_hq."Task" t JOIN creator_hq."Agent" a ON a.id=t."agentId" WHERE t.id=$1',taskId);
 if(!s)failure('EXECUTION_TASK_NOT_FOUND',404);if(s.agentId!=='director'||s.agentStudio!=='HQ'||!s.agentEnabled)failure('EXECUTION_ATLAS_REQUIRED',400);
 if(containsSecret(s.title+'\n'+s.description+'\n'+s.instructions))failure('EXECUTION_INPUT_REJECTED',400);
 return makeContract({taskId:s.id,title:s.title,description:s.description,studio:s.studio,agentId:'director'},s.instructions);
}
async function save(tx:Sql,j:Job){await tx.$executeRawUnsafe('UPDATE creator_hq."ExecutionJob" SET status=$2,metadata=$3::jsonb,enabled=$4,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1',j.id,j.status,JSON.stringify(j.metadata),j.enabled);j.updatedAt=await now(tx);}
export interface JobLauncher {readonly kind:'disabled'|'fake'|'native';execute(c:ExecutionContract,approval:{id:string;jobId:string;actorType:'human';actorId:'owner';digest:string;decision:'approved';expiresAt:number},signal:AbortSignal):Promise<ExecutionResult>}
export async function executionSchemaReady(tx:Sql){
  const [row]=await tx.$queryRawUnsafe<{ready:boolean}[]>('SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=\'creator_hq."ExecutionJob"\'::regclass AND conname=\'ExecutionJob_atlas_text_check\' AND convalidated) AND NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=\'creator_hq."ExecutionJob"\'::regclass AND conname=\'ExecutionJob_disabled_check\') AND EXISTS(SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid=\'creator_hq."ExecutionJob"\'::regclass AND c.relname=\'ExecutionJob_single_running_idx\' AND i.indisunique AND i.indisvalid) AS ready');return row?.ready===true;
}
export class ExecutionJobs {
 constructor(private readonly db:JobDatabase,private readonly launcher:JobLauncher){if(launcher.kind==='fake'&&(!isReviewedFakeLauncher(launcher)||process.env.NODE_ENV!=='test'))throw Error('EXECUTION_FAKE_TEST_ONLY');if(launcher.kind==='native'&&!isReviewedNativeLauncher(launcher))throw Error('EXECUTION_NATIVE_REVIEW_REQUIRED');}
 private tx<T>(fn:(t:Sql)=>Promise<T>){return this.db.$transaction(fn,options);}
 private async activationReady(tx:Sql,id?:string){
  if(id!==undefined&&!permitsNativeJob(id))return false;
  if(!NATIVE_EXECUTION_RELEASE_APPROVED||this.launcher.kind!=='native')return false;
  return executionSchemaReady(tx);
 }
 async availability(){if(!NATIVE_EXECUTION_RELEASE_APPROVED||this.launcher.kind!=='native')return false;return this.tx(tx=>this.activationReady(tx));}
 async create(taskId:string,requestId:string,owner:Owner){return this.tx(async tx=>{await mutex(tx);const contract=await snapshot(tx,taskId,true),digest=contractDigest(contract);
  const existing=await tx.$queryRawUnsafe<{id:string}[]>('SELECT id FROM creator_hq."ExecutionJob" WHERE id=$1',requestId);
  if(existing.length){const j=await readJob(tx,requestId);if(j.taskId!==taskId||j.metadata.digest!==digest)failure('EXECUTION_REQUEST_CONFLICT');return this.publicJob(tx,j);}
  const approvalId='execution:'+requestId;
  const metadata:Metadata={version:2,source:this.launcher.kind==='fake'?'simulation':'codex',contract,digest,approvalId,approval:null,worker:null,cancelRequested:false,result:null,error:null};
  await tx.$executeRawUnsafe('INSERT INTO creator_hq."Approval"(id,title,"agentId",status,simulated,"createdAt") VALUES($1,$2,$3,\'Pending\',$4,CURRENT_TIMESTAMP)',approvalId,'Execution approval: '+requestId,'director',metadata.source==='simulation');
  await tx.$executeRawUnsafe('INSERT INTO creator_hq."ExecutionJob"(id,"taskId","agentId",status,enabled,metadata,"createdAt","updatedAt") VALUES($1,$2,$3,\'awaiting_approval\',false,$4::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',requestId,taskId,'director',JSON.stringify(metadata));
  return this.publicJob(tx,await readJob(tx,requestId));
 });}
 async decide(id:string,digest:string,decision:'Approved'|'Rejected',owner:Owner){return this.tx(async tx=>{await mutex(tx);const j=await readJob(tx,id,true);if(j.status!=='awaiting_approval'||j.metadata.approval)failure('EXECUTION_APPROVAL_CONFLICT');
  const current=contractDigest(await snapshot(tx,j.taskId,true));if(current!==j.metadata.digest||digest!==current)failure('EXECUTION_APPROVAL_STALE');
  const changed=await tx.$executeRawUnsafe('UPDATE creator_hq."Approval" SET status=$2 WHERE id=$1 AND status=\'Pending\'',j.metadata.approvalId,decision);if(changed!==1)failure('EXECUTION_APPROVAL_CONFLICT');
  if(decision==='Rejected'){j.status='cancelled';j.metadata.error='HUMAN_REJECTED'}else{const time=await now(tx);j.metadata.approval={actor:owner.id,sessionAudit:owner.sessionAudit,digest:current,decidedAt:time.toISOString(),expiresAt:new Date(time.getTime()+1800000).toISOString()};j.status='planned';}
  await save(tx,j);return this.publicJob(tx,j);
 });}
 private async publicJob(tx:Sql,j:Job){let current=false;try{current=contractDigest(await snapshot(tx,j.taskId))===j.metadata.digest}catch(error){if(!(error instanceof JobFailure))throw error}
  const approval=j.metadata.approval;const time=await now(tx);const [{status:approvalStatus}]=await tx.$queryRawUnsafe<{status:string}[]>('SELECT status FROM creator_hq."Approval" WHERE id=$1',j.metadata.approvalId);
  return {id:j.id,taskId:j.taskId,agentId:j.agentId,studio:j.metadata.contract.scope.studio,status:j.status,source:j.metadata.source,enabled:j.enabled,executionAvailable:await this.activationReady(tx,j.id),digest:j.metadata.digest,contract:j.metadata.contract,approval:{id:j.metadata.approvalId,status:approvalStatus,valid:current&&!!approval&&approvalStatus==='Approved'&&Date.parse(approval.expiresAt)>time.getTime(),actor:approval?.actor??null},cancelRequested:j.metadata.cancelRequested,result:j.metadata.result,error:j.metadata.error,createdAt:j.createdAt,updatedAt:j.updatedAt,leaseExpired:!!j.metadata.worker&&Date.parse(j.metadata.worker.leaseUntil)<=time.getTime()};
 }
 async get(id:string){return this.tx(async tx=>this.publicJob(tx,await readJob(tx,id)));}
 async list(){return this.tx(async tx=>{const rows=await tx.$queryRawUnsafe<{id:string}[]>('SELECT id FROM creator_hq."ExecutionJob" WHERE metadata->>\'version\'=\'2\' ORDER BY "createdAt" DESC LIMIT 50');return Promise.all(rows.map(async r=>this.publicJob(tx,await readJob(tx,r.id))));});}
 async cancel(id:string,owner:Owner){return this.tx(async tx=>{await mutex(tx);const j=await readJob(tx,id,true);if(!['awaiting_approval','planned','running'].includes(j.status))failure('EXECUTION_JOB_TERMINAL');j.metadata.cancelRequested=true;if(j.status!=='running'){j.status='cancelled';await tx.$executeRawUnsafe('UPDATE creator_hq."Approval" SET status=\'Rejected\' WHERE id=$1 AND status=\'Pending\'',j.metadata.approvalId);}await save(tx,j);return this.publicJob(tx,j);});}
 async claim(id:string){
  // Native claims require the reviewed release, exact selected job and existing DB/approval gates.
  if(this.launcher.kind!=='fake'&&(!permitsNativeJob(id)||this.launcher.kind!=='native'))failure('REAL_EXECUTION_DISABLED',423);
  const native=this.launcher.kind==='native';
  return this.tx(async tx=>{await mutex(tx);if(native&&!await this.activationReady(tx))failure('EXECUTION_SCHEMA_NOT_READY',423);const active=await tx.$queryRawUnsafe<{id:string}[]>('SELECT id FROM creator_hq."ExecutionJob" WHERE status=\'running\' AND metadata->>\'version\'=\'2\' LIMIT 1');if(active.length)failure('EXECUTION_WORKER_BUSY');
   const j=await readJob(tx,id,true);if(j.metadata.source!==(native?'codex':'simulation')||j.enabled||j.status!=='planned'||j.metadata.worker)failure('EXECUTION_ALREADY_STARTED');
   const time=await now(tx),approval=j.metadata.approval;const [a]=await tx.$queryRawUnsafe<{status:string}[]>('SELECT status FROM creator_hq."Approval" WHERE id=$1 FOR UPDATE',j.metadata.approvalId);
   if(!approval||a?.status!=='Approved'||approval.digest!==j.metadata.digest||Date.parse(approval.expiresAt)<=time.getTime()||contractDigest(await snapshot(tx,j.taskId,true))!==approval.digest||j.metadata.cancelRequested)failure('EXECUTION_APPROVAL_STALE');
   j.enabled=native;j.status='running';j.metadata.worker={token:randomUUID(),startedAt:time.toISOString(),leaseUntil:new Date(time.getTime()+90000).toISOString()};await save(tx,j);return j;
  });
 }
 async complete(id:string,token:string,result:unknown,errorCode?:string){return this.tx(async tx=>{await mutex(tx);const j=await readJob(tx,id,true),time=await now(tx);if(j.status!=='running'||j.metadata.worker?.token!==token||Date.parse(j.metadata.worker.leaseUntil)<=time.getTime())failure('EXECUTION_WORKER_OWNERSHIP_LOST');
  let parsed=resultSchema.safeParse(result);if(j.metadata.cancelRequested){j.status='cancelled';j.metadata.error='EXECUTION_CANCELLED'}else if(errorCode){j.status='failed';j.metadata.error=/^[A-Z_]+$/.test(errorCode)?errorCode:'EXECUTION_FAILED'}else if(!parsed.success||containsSecret(JSON.stringify(parsed.data))){j.status='failed';j.metadata.error='EXECUTION_RESULT_REJECTED'}else if(contractDigest(await snapshot(tx,j.taskId,true))!==j.metadata.digest){j.status='failed';j.metadata.error='EXECUTION_APPROVAL_STALE'}else{
   j.status='completed';j.metadata.result=parsed.data;
   const reportId=randomUUID();await tx.$executeRawUnsafe('INSERT INTO creator_hq."AgentReport"(id,"sourceId","agentId","taskId","approvalId",source,status,"summaryData","originalTechnicalReport","createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)',reportId,'execution:'+j.id,j.agentId,j.taskId,j.metadata.approvalId,j.metadata.source,parsed.data.outcome==='needs_approval'?'awaiting_approval':'completed',JSON.stringify({template:'execution_result',...parsed.data}),JSON.stringify({jobId:j.id,source:j.metadata.source,result:parsed.data}));
   await tx.$executeRawUnsafe('INSERT INTO creator_hq."Activity"(id,"agentId",message,simulated,"createdAt") VALUES($1,$2,$3,$4,CURRENT_TIMESTAMP)',randomUUID(),j.agentId,'Execution job completed: '+j.id,j.metadata.source==='simulation');
   await tx.$executeRawUnsafe('UPDATE creator_hq."Task" SET status=\'Review\',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1',j.taskId);
  }j.enabled=false;await save(tx,j);return this.publicJob(tx,j);
 });}
 async run(id:string){const j=await this.claim(id),token=j.metadata.worker!.token,controller=new AbortController();let polling=false;const poll=setInterval(async()=>{if(polling)return;polling=true;try{const current=await this.get(id);if(current.cancelRequested||current.leaseExpired)controller.abort()}catch{controller.abort()}finally{polling=false}},500);const timeout=setTimeout(()=>controller.abort(),j.metadata.contract.timeoutMs);
  try{const a=j.metadata.approval!;const result=await this.launcher.execute(j.metadata.contract,{id:j.metadata.approvalId,jobId:j.id,actorType:'human',actorId:'owner',decision:'approved',digest:a.digest,expiresAt:Date.parse(a.expiresAt)},controller.signal);return await this.complete(id,token,result)}catch(error){if(error instanceof JobFailure)throw error;return await this.complete(id,token,null,controller.signal.aborted?'EXECUTION_ABORTED':'EXECUTION_FAILED')}finally{clearInterval(poll);clearTimeout(timeout)}
 }
}
