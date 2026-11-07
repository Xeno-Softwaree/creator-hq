import {z} from 'zod';
import {contractSchema,verifyApproval,type ExecutionContract} from './contract.js';

export const resultSchema=z.object({version:z.literal(1),summary:z.string().min(1).max(8000),outcome:z.enum(['completed','needs_approval']),actions:z.array(z.string().max(1000)).max(30)}).strict();
export type ExecutionResult=z.infer<typeof resultSchema>;
// Only these reviewed event shapes leave the parser. Commands, stderr and unknown payloads never do.
export type SafeEvent={type:'thread.started';threadId:string}|{type:'progress'}|{type:'result';result:ExecutionResult}|{type:'turn.completed'};
export function containsSecret(value:string,secrets:readonly string[]=[]){
 return /(?:postgres(?:ql)?:\/\/|\b(?:DATABASE_URL|DIRECT_URL|PGPASSWORD|OPENAI_API_KEY|CODEX_API_KEY)\b|\bBearer\s+\S+|\bsk-[a-zA-Z0-9_-]{8,}|(?:password|secret|token)\s*[=:]\s*\S+)/i.test(value)||secrets.some(s=>s.length>0&&(value.includes(s)||value.includes(encodeURIComponent(s))));
}
export class JsonlParser {
 private buffer='';private bytes=0;private ended=false;private phase:'initial'|'thread'|'turn'|'result'|'complete'='initial';
 constructor(private readonly secrets:readonly string[]=[]){ }
 push(chunk:string):SafeEvent[]{
  if(this.ended)throw Error('EXECUTION_OUTPUT_INVALID');
  this.bytes+=Buffer.byteLength(chunk);if(this.bytes>131072)throw Error('EXECUTION_OUTPUT_LIMIT');
  this.buffer+=chunk;if(this.buffer.length>32768&&!this.buffer.includes('\n'))throw Error('EXECUTION_OUTPUT_LIMIT');
  const lines=this.buffer.split('\n');this.buffer=lines.pop()!;return lines.filter(s=>s.trim()).flatMap(line=>this.line(line));
 }
 finish():SafeEvent[]{const rest=this.buffer;this.buffer='';this.ended=true;return rest.trim()?this.line(rest):[];}
 private line(line:string):SafeEvent[]{
  if(line.length>32768||containsSecret(line,this.secrets))throw Error('EXECUTION_OUTPUT_REJECTED');
  let value:unknown;try{value=JSON.parse(line)}catch{throw Error('EXECUTION_OUTPUT_INVALID')}
  const leaks=(v:unknown):boolean=>typeof v==='string'?containsSecret(v,this.secrets):Array.isArray(v)?v.some(leaks):v!==null&&typeof v==='object'?Object.values(v).some(leaks):false;
  if(leaks(value))throw Error('EXECUTION_OUTPUT_REJECTED');
  const v=z.object({type:z.string()}).passthrough().safeParse(value);if(!v.success)throw Error('EXECUTION_OUTPUT_INVALID');
  const e=v.data;
  if(e.type==='thread.started'){const r=z.object({type:z.literal('thread.started'),thread_id:z.string().uuid()}).strict().safeParse(e);if(!r.success||this.phase!=='initial')throw Error('EXECUTION_OUTPUT_INVALID');this.phase='thread';return [{type:'thread.started',threadId:r.data.thread_id}];}
  if(e.type==='turn.started'){if(this.phase!=='thread')throw Error('EXECUTION_OUTPUT_INVALID');this.phase='turn';return [{type:'progress'}];}
  if(e.type==='item.completed'){
   const r=z.object({type:z.literal('item.completed'),item:z.object({id:z.string(),type:z.literal('agent_message'),text:z.string()}).strict()}).strict().safeParse(e);
   if(!r.success||this.phase!=='turn')throw Error('EXECUTION_OUTPUT_UNSUPPORTED');
   let output:unknown;try{output=JSON.parse(r.data.item.text)}catch{throw Error('EXECUTION_RESULT_INVALID')}
   if(leaks(output))throw Error('EXECUTION_OUTPUT_REJECTED');
   const result=resultSchema.safeParse(output);if(!result.success)throw Error('EXECUTION_RESULT_INVALID');this.phase='result';return [{type:'result',result:result.data}];
  }
  if(e.type==='turn.completed'){if(this.phase!=='result')throw Error('EXECUTION_OUTPUT_INVALID');this.phase='complete';return [{type:'turn.completed'}];}
  if(e.type==='turn.failed'||e.type==='error')throw Error('EXECUTION_PROCESS_FAILED');
  throw Error('EXECUTION_OUTPUT_UNSUPPORTED');
 }
}
// Deliberately empty: no API/DB/admin/auth variables or inherited PATH/config reach the fake child.
// A real Windows launcher must separately prove OS isolation and credential access before activation.
export function executionEnvironment(_parent:NodeJS.ProcessEnv):Readonly<Record<string,string>> {return Object.freeze({NO_COLOR:'1'});}
export const codexOutputSchema={type:'object',additionalProperties:false,required:['version','summary','outcome','actions'],properties:{version:{const:1},summary:{type:'string',minLength:1,maxLength:8000},outcome:{enum:['completed','needs_approval']},actions:{type:'array',maxItems:30,items:{type:'string',maxLength:1000}}}} as const;
export function codexPlan(contract:ExecutionContract){
 contractSchema.parse(contract);
 return {enabled:false as const,blockedBy:['EXECUTION_DISABLED','WINDOWS_ISOLATION_UNVERIFIED','HUMAN_APPROVAL_REQUIRED'],arguments:['exec','--ignore-user-config','--config','approval_policy="never"','--sandbox','read-only','--json','--color','never','--ephemeral','-'],stdin:JSON.stringify({instructions:contract.instructions,task:contract.task,scope:contract.scope}),environment:executionEnvironment({}),outputSchema:codexOutputSchema};
}
type FakeStep={chunk?:string;delayMs?:number;crash?:boolean};
export type FakeProcess={readonly kind:'fake';run:(signal:AbortSignal,onChunk:(chunk:string)=>void)=>Promise<number>;stop:()=>Promise<void>};
const trustedFakes=new WeakSet<object>();
export function fakeProcess(steps:readonly FakeStep[],exitCode=0):FakeProcess{
 const script=z.array(z.object({chunk:z.string().max(131072).optional(),delayMs:z.number().int().min(0).max(120000).optional(),crash:z.boolean().optional()}).strict()).max(100).parse(steps);
 z.number().int().min(0).max(255).parse(exitCode);
 const controller=new AbortController();
 const p:FakeProcess={kind:'fake',async run(signal,onChunk){
  for(const step of script){
   if(signal.aborted||controller.signal.aborted)throw Error('FAKE_ABORTED');
   if(step.delayMs)await new Promise<void>((resolve,reject)=>{const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',abort);};const abort=()=>{done();reject(Error('FAKE_ABORTED'));};const timer=setTimeout(()=>{done();resolve()},step.delayMs);signal.addEventListener('abort',abort,{once:true});controller.signal.addEventListener('abort',abort,{once:true});});
   if(step.crash)throw Error('FAKE_CRASH');if(step.chunk)onChunk(step.chunk);
  }return exitCode;
 },async stop(){controller.abort()}};
 Object.freeze(p);trustedFakes.add(p);return p;
}
let active=false;
const attempted=new Set<string>();
const sessions=new Map<string,{jobId:string;studio:string}>();
export class FakeCodexAdapter {
 async execute(input:{jobId:string;contract:ExecutionContract;loadApproval:()=>unknown;process:FakeProcess;signal?:AbortSignal;secrets?:readonly string[]}){
  const {jobId}=input;const parsed=contractSchema.safeParse(input.contract);if(!parsed.success)throw Error('EXECUTION_CONTRACT_INVALID');const contract=parsed.data;
  if(!z.string().uuid().safeParse(jobId).success)throw Error('EXECUTION_JOB_INVALID');
  if(!trustedFakes.has(input.process))throw Error('REAL_EXECUTION_DISABLED');
  if(active)throw Error('EXECUTION_BUSY');if(attempted.has(jobId))throw Error('EXECUTION_DUPLICATE');
  if(attempted.size>=1000)throw Error('EXECUTION_TEST_CAPACITY');
  verifyApproval(contract,jobId,input.loadApproval());
  if(input.signal?.aborted)throw Error('EXECUTION_CANCELLED');
  active=true;attempted.add(jobId);
  const controller=new AbortController(),parser=new JsonlParser(input.secrets),events:SafeEvent[]=[];
  const cancel=()=>controller.abort();input.signal?.addEventListener('abort',cancel,{once:true});
  let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},contract.timeoutMs);
  try{
   const accept=(batch:SafeEvent[])=>{for(const event of batch){if(event.type==='thread.started'){if(sessions.has(event.threadId))throw Error('EXECUTION_SESSION_REUSE');sessions.set(event.threadId,{jobId,studio:contract.scope.studio});}events.push(event);}};
   const code=await input.process.run(controller.signal,chunk=>accept(parser.push(chunk)));
   accept(parser.finish());if(code!==0)throw Error('EXECUTION_PROCESS_FAILED');
   const results=events.filter(e=>e.type==='result');
   if(events.filter(e=>e.type==='thread.started').length!==1||results.length!==1||events.at(-1)?.type!=='turn.completed'||events.filter(e=>e.type==='turn.completed').length!==1)throw Error('EXECUTION_OUTPUT_INVALID');
   const result=(results[0] as Extract<SafeEvent,{type:'result'}>).result;
   return {source:'simulation' as const,provider:'fake_codex' as const,enabled:false as const,status:result.outcome==='needs_approval'?'awaiting_approval' as const:'completed' as const,jobId,studio:contract.scope.studio,events,result};
  }catch(error){
   const code=timedOut?'EXECUTION_TIMEOUT':controller.signal.aborted?'EXECUTION_CANCELLED':error instanceof Error&&/^EXECUTION_[A-Z_]+$/.test(error.message)?error.message:'EXECUTION_PROCESS_FAILED';
   // Never propagate raw child errors or partial output.
   return {source:'simulation' as const,provider:'fake_codex' as const,enabled:false as const,status:code==='EXECUTION_CANCELLED'?'cancelled' as const:'failed' as const,jobId,studio:contract.scope.studio,code,events:[]};
  }finally{clearTimeout(timer);input.signal?.removeEventListener('abort',cancel);await input.process.stop();active=false;}
 }
}
