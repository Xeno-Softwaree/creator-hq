import {randomUUID} from 'node:crypto';
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,realpathSync,lstatSync} from 'node:fs';
import {resolve,join,sep,dirname,isAbsolute} from 'node:path';
import {FakeCodexAdapter,JsonlParser,fakeProcess,codexOutputSchema,type FakeProcess,type ExecutionResult,type SafeEvent} from './adapter.js';
import {verifyApproval,type ExecutionContract,type ExecutionApproval} from './contract.js';
import {assertNormalWindowsUser} from "./windows-host.js";
import {protocolChild,type ProtocolFixture} from "./protocol-fixture.js";
import type {JobLauncher} from './jobs.js';
import {StringDecoder} from 'node:string_decoder';

// A code-review/release gate, never an HTTP or environment switch in Package 4.
import {NATIVE_EXECUTION_RELEASE_APPROVED,permitsNativeJob} from './release.js';
const reviewedFakes=new WeakSet<object>();
const reviewedNative=new WeakSet<object>();
export function isReviewedNativeLauncher(value:object){return reviewedNative.has(value);}
export function isReviewedFakeLauncher(value:object){return reviewedFakes.has(value);}
export function fakeJobLauncher(factory:(contract:ExecutionContract)=>FakeProcess):JobLauncher {
 const adapter=new FakeCodexAdapter();const launcher:JobLauncher=Object.freeze({kind:'fake',async execute(contract:ExecutionContract,approval:ExecutionApproval,signal:AbortSignal){const response=await adapter.execute({jobId:approval.jobId,contract,loadApproval:()=>approval,process:factory(contract),signal});if(!response.result)throw Error('EXECUTION_FAKE_FAILED');return response.result;}});reviewedFakes.add(launcher);return launcher;
}
export function fakeTextProcess(summary='Isolated fake text result'){
 const result={version:1,summary,outcome:'completed',actions:['Prepared simulated text']};
 return fakeProcess([{chunk:[{type:'thread.started',thread_id:randomUUID()},{type:'turn.started'},{type:'item.completed',item:{id:'result',type:'agent_message',text:JSON.stringify(result)}},{type:'turn.completed'}].map(e=>JSON.stringify(e)).join('\n')+'\n'}]);
}
export type RuntimeSettings={codexExecutable:string;scratchRoot:string;codexHome:string;nodeExecutable:string;mcpIds:string[];pluginIds:string[];systemRoot:string;userProfile:string;expectedVersion?:string};
export function integrationOverride(kind:'mcp_servers'|'plugins',id:string){if(!/^[-A-Za-z0-9_@]{1,200}$/.test(id))throw Error('CODEX_IDENTIFIER_INVALID');return `${kind}.${id}.enabled=false`;}
export function runtimePlan(settings:RuntimeSettings,jobDirectory:string,stateDirectory:string){
 for(const p of [settings.codexExecutable,settings.scratchRoot,settings.codexHome,settings.nodeExecutable,settings.systemRoot,settings.userProfile,jobDirectory,stateDirectory])if(!isAbsolute(p))throw Error('CODEX_PATH_CONFIGURATION_INVALID');
 const root=resolve(settings.scratchRoot);for(const p of [jobDirectory,stateDirectory])if(!resolve(p).startsWith(root+sep))throw Error('CODEX_SCRATCH_BOUNDARY_INVALID');
 const q=(s:string)=>JSON.stringify(s.replaceAll('\\','/'));const args=['--strict-config'];
 for(const flag of ['view_image','hooks','plugins','apps','multi_agent','shell_tool','browser_use','browser_use_external','browser_use_full_cdp_access','in_app_browser','remote_plugin','plugin_discovery_prefetch','skill_search','skill_mcp_dependency_install','goals','memories','mcp_connection_sharing'])args.push('-c',`features.${flag}=false`);
 for(const setting of ['features.code_mode.enabled=false','web_search="disabled"','windows.sandbox="mxc"','forced_login_method="chatgpt"','history.persistence="none"','notify=[]','model_provider="openai"','project_doc_max_bytes=0','include_environment_context=false','check_for_update_on_startup=false','default_permissions="creator_job"','approval_policy="never"','permissions.creator_job={filesystem={":root"="deny",":minimal"="read",'+q(jobDirectory)+'="read",'+q(dirname(settings.nodeExecutable))+'="read"},network={enabled=false}}','sqlite_home='+q(stateDirectory),'log_dir='+q(stateDirectory)])args.push('-c',setting);
 for(const id of settings.mcpIds)args.push('-c',integrationOverride('mcp_servers',id));for(const id of settings.pluginIds)args.push('-c',integrationOverride('plugins',id));
 // Explicit allowlist: no inherited API, DB, admin, Node injection, proxy or token values.
 const environment={SystemRoot:settings.systemRoot,WINDIR:settings.systemRoot,USERPROFILE:settings.userProfile,CODEX_HOME:settings.codexHome,CODEX_SQLITE_HOME:stateDirectory,TEMP:stateDirectory,TMP:stateDirectory,PATH:dirname(settings.nodeExecutable),NO_COLOR:'1',RUST_LOG:'off'};
 return {executable:settings.codexExecutable,args,environment,cwd:jobDirectory,expected:{mcpIds:settings.mcpIds,pluginIds:settings.pluginIds,version:settings.expectedVersion??"0.166.0",filesystem:{[":root"]:"deny",[":minimal"]:"read",[jobDirectory.replaceAll("\\","/")]:"read",[dirname(settings.nodeExecutable).replaceAll("\\","/")]:"read"}}};
}
type Plan=ReturnType<typeof runtimePlan>;
type SpawnChild=(plan:Plan,args:string[])=>ChildProcessWithoutNullStreams;
export function isolationVerified(plan:Plan,c:any){
 try{const p=c.permissions?.creator_job,f=c.features;const features=plan.args.filter(x=>/^features\.[a-z_]+=false$/.test(x)).map(x=>x.slice(9,-6));
  const exact=(a:unknown,b:unknown)=>JSON.stringify(Object.entries(a??{}).sort())===JSON.stringify(Object.entries(b??{}).sort());
  const samePath=(a:unknown,b:string)=>typeof a==='string'&&isAbsolute(a)&&(process.platform==='win32'?resolve(a).toLowerCase()===resolve(b).toLowerCase():resolve(a)===resolve(b));
  const entries=(key:string,ids:string[])=>exact(Object.fromEntries(Object.entries(c[key]??{}).map(([id,v]:[string,any])=>[id,v.enabled])),Object.fromEntries(ids.map(id=>[id,false])));
  return features.every(k=>f?.[k]===false)&&f?.code_mode?.enabled===false&&c.windows?.sandbox==='mxc'&&c.web_search==='disabled'&&c.forced_login_method==='chatgpt'&&c.model_provider==='openai'&&Object.keys(c.model_providers??{}).length===0&&!c.openai_base_url&&!c.chatgpt_base_url&&c.default_permissions==='creator_job'&&c.approval_policy==='never'&&exact(p?.filesystem,plan.expected.filesystem)&&p?.network?.enabled===false&&c.project_doc_max_bytes===0&&c.include_environment_context===false&&c.history?.persistence==='none'&&Array.isArray(c.notify)&&c.notify.length===0&&samePath(c.sqlite_home,plan.environment.CODEX_SQLITE_HOME)&&samePath(c.log_dir,plan.environment.CODEX_SQLITE_HOME)&&entries('mcp_servers',plan.expected.mcpIds)&&entries('plugins',plan.expected.pluginIds);
 }catch{return false}
}
async function verifyVersion(plan:Plan,signal:AbortSignal,createChild?:SpawnChild){return new Promise<void>((yes,no)=>{
 if(signal.aborted){no(Error('CODEX_CANCELLED'));return}
 const child=createChild?createChild(plan,['--version']):spawn(plan.executable,['--version'],{cwd:plan.cwd,env:plan.environment,windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',failure=false;
 const stop=()=>{failure=true;child.kill()};const timer=setTimeout(stop,5000);signal.addEventListener('abort',stop,{once:true});child.stdin.on('error',()=>{});child.on('error',stop);child.stderr.on('data',()=>{});child.stdout.on('data',chunk=>{output+=String(chunk);if(output.length>256)stop()});child.on('spawn',()=>child.stdin.end());
 child.on('close',code=>{clearTimeout(timer);signal.removeEventListener('abort',stop);if(failure||code!==0||output.trim()!=='codex-cli '+plan.expected.version)no(Error('CODEX_VERSION_NOT_VERIFIED'));else yes()});
 });}
async function inspectNative(plan:Plan,signal:AbortSignal,createChild?:SpawnChild){return new Promise<void>((resolvePromise,reject)=>{
 if(signal.aborted){reject(Error('CODEX_CANCELLED'));return}
 let buffer='',bytes=0,done=false,valid=false;const child=createChild?createChild(plan,['app-server','--stdio']):spawn(plan.executable,[...plan.args,'app-server','--stdio'],{cwd:plan.cwd,env:plan.environment,windowsHide:true,stdio:['pipe','pipe','pipe']});
 const stop=(error?:string)=>{if(done)return;done=true;failure=error;child.stdin.end();child.kill()};let failure:string|undefined;
 const timer=setTimeout(()=>stop('CODEX_PREFLIGHT_TIMEOUT'),15000);const abort=()=>stop('CODEX_CANCELLED');signal.addEventListener('abort',abort,{once:true});
 const send=(o:unknown)=>child.stdin.write(JSON.stringify(o)+'\n');child.stdin.on('error',()=>{});child.on('error',()=>stop('CODEX_STARTUP_FAILED'));child.stderr.on('data',()=>{});
 child.stdout.on('data',chunk=>{if(done)return;bytes+=Buffer.byteLength(chunk);buffer+=String(chunk);if(bytes>1000000)return stop('CODEX_OUTPUT_LIMIT');const lines=buffer.split('\n');buffer=lines.pop()!;for(const line of lines){let m;try{m=JSON.parse(line)}catch{continue}
 if(m.id===1){if(m.error)return stop('CODEX_INITIALIZE_FAILED');send({method:'initialized'});send({id:2,method:'config/read',params:{cwd:plan.cwd,includeLayers:false}})}
 if(m.id===2){if(m.error)return stop("CODEX_CONFIG_READ_FAILED");if(!isolationVerified(plan,m.result?.config))return stop("CODEX_ISOLATION_NOT_VERIFIED");send({id:3,method:"account/read",params:{refreshToken:false}})}
 if(m.id===3){if(m.error||m.result?.account?.type!=='chatgpt')return stop('CODEX_CHATGPT_AUTH_REQUIRED');valid=true;stop();}
 }});
 child.on('spawn',()=>send({id:1,method:'initialize',params:{clientInfo:{name:'creator_hq_job_preflight',version:'1.0'},capabilities:{experimentalApi:true}}}));
 child.on('close',()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);failure||!valid?reject(Error(failure??'CODEX_PREFLIGHT_CLOSED')):resolvePromise()});
 });}
async function executeNative(plan:Plan,contract:ExecutionContract,signal:AbortSignal,createChild?:SpawnChild){return new Promise<ExecutionResult>((resolvePromise,reject)=>{
 if(signal.aborted){reject(Error('CODEX_CANCELLED'));return}
 const schema=join(plan.cwd,'result-schema.json');if(!createChild)writeFileSync(schema,JSON.stringify(codexOutputSchema),{flag:'wx'});
 const child=createChild?createChild(plan,['exec']):spawn(plan.executable,[...plan.args,'exec','--ephemeral','--json','--color','never','--skip-git-repo-check','--output-schema',schema,'-'],{cwd:plan.cwd,env:plan.environment,windowsHide:true,stdio:['pipe','pipe','pipe']});
 const parser=new JsonlParser(),decoder=new StringDecoder('utf8'),events:SafeEvent[]=[];let failure:string|undefined;const fail=(code:string)=>{failure??=code;child.kill()};const abort=()=>fail('CODEX_CANCELLED');signal.addEventListener('abort',abort,{once:true});const timer=setTimeout(()=>fail('CODEX_TIMEOUT'),Math.min(contract.timeoutMs,60000));
 child.stdin.on('error',()=>{});child.on('error',()=>fail('CODEX_STARTUP_FAILED'));child.stderr.on('data',b=>{if(/retry|reconnecting/i.test(String(b)))fail('CODEX_RETRY_BLOCKED')});
 child.stdout.on('data',chunk=>{try{events.push(...parser.push(decoder.write(chunk)))}catch{fail('CODEX_OUTPUT_REJECTED')}});
 child.on('spawn',()=>child.stdin.end(JSON.stringify({role:'Atlas',instructions:contract.instructions,task:contract.task,scope:contract.scope,permissions:contract.permissions})));
 child.on('close',code=>{clearTimeout(timer);signal.removeEventListener('abort',abort);try{events.push(...parser.push(decoder.end()),...parser.finish())}catch{failure??='CODEX_OUTPUT_REJECTED'}const outputs=events.filter((e):e is Extract<SafeEvent,{type:'result'}>=>e.type==='result');if(failure||code!==0||outputs.length!==1||events.at(-1)?.type!=='turn.completed')reject(Error(failure??'CODEX_EXECUTION_FAILED'));else resolvePromise(outputs[0].result)});
 });}
// Exercises the same protocol functions with streams only; never a real CLI or filesystem write.
export function protocolTestLauncher(plan:Plan,fixture:ProtocolFixture):JobLauncher{
 if(process.env.NODE_ENV!=='test')throw Error('EXECUTION_FAKE_TEST_ONLY');
 const createChild:SpawnChild=(_plan,args)=>{if(args[0]==='--version'){fixture.calls?.push('version');return protocolChild('version',fixture)}if(args[0]==='app-server')return protocolChild('preflight',fixture);if(args[0]==='exec')return protocolChild('exec',fixture);throw Error('EXECUTION_FAKE_COMMAND_REJECTED')};
 const launcher:JobLauncher=Object.freeze({kind:'fake',async execute(contract:ExecutionContract,approval:ExecutionApproval,signal:AbortSignal){verifyApproval(contract,approval.jobId,approval);if(signal.aborted)throw Error('CODEX_CANCELLED');await verifyVersion(plan,signal,createChild);await inspectNative(plan,signal,createChild);if(signal.aborted)throw Error('CODEX_CANCELLED');return executeNative(plan,contract,signal,createChild)}});reviewedFakes.add(launcher);return launcher;
}
export class NativeCodexLauncher implements JobLauncher {
 get kind():'native'|'disabled'{return NATIVE_EXECUTION_RELEASE_APPROVED&&this.settings?'native':'disabled'}
 constructor(private readonly settings?:RuntimeSettings){reviewedNative.add(this);}
 async execute(contract:ExecutionContract,_approval:ExecutionApproval,signal:AbortSignal):Promise<ExecutionResult>{
  if(!permitsNativeJob(_approval?.jobId))throw Error('REAL_EXECUTION_DISABLED');
  if(process.platform!=='win32'||!this.settings)throw Error('CODEX_WINDOWS_CONFIGURATION_REQUIRED');
  verifyApproval(contract,_approval.jobId,_approval);
  assertNormalWindowsUser();
  if(signal.aborted)throw Error('CODEX_CANCELLED');
  // No junction/symlink scratch root, no shell, no credential copying or global configuration writes.
  if(lstatSync(this.settings.scratchRoot).isSymbolicLink())throw Error('CODEX_SCRATCH_BOUNDARY_INVALID');
  const root=realpathSync(this.settings.scratchRoot),directory=mkdtempSync(join(root,'job-'));const job=join(directory,'input'),state=join(directory,'state');mkdirSync(job);mkdirSync(state);
  const plan=runtimePlan(this.settings,job,state);await verifyVersion(plan,signal);await inspectNative(plan,signal);return executeNative(plan,contract,signal);
 }
}
