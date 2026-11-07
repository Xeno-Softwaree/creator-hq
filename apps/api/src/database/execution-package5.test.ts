import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import {ownerEnvironment} from '../execution/prepare-owner.js';
import {OwnerSessions} from '../execution/owner.js';
import {runtimePlan,isolationVerified,protocolTestLauncher,NativeCodexLauncher} from '../execution/launcher.js';
import {loadRuntimeSettings,assertPrivateOwnerDirectory} from '../execution/windows-host.js';
import {makeContract,contractDigest} from '../execution/contract.js';
import {ExecutionJobs,type JobDatabase} from '../execution/jobs.js';
import {isolatedPostgres} from './execution-test-fixture.js';
import {isolateApiTestEnvironment} from './test-environment.js';
isolateApiTestEnvironment('file:./unused-package5.db');
const root=process.cwd(),settings={codexExecutable:resolve(root,'synthetic/codex.exe'),scratchRoot:resolve(root,'.local/synthetic'),codexHome:resolve(root,'synthetic/home'),nodeExecutable:process.execPath,mcpIds:['fake-server'],pluginIds:['fake@plugin'],systemRoot:resolve(root,'synthetic/system'),userProfile:resolve(root,'synthetic/profile')};
const plan=runtimePlan(settings,join(settings.scratchRoot,'job'),join(settings.scratchRoot,'state'));
function config(){const features:Record<string,any>={code_mode:{enabled:false}};for(const arg of plan.args)if(/^features\.[a-z_]+=false$/.test(arg))features[arg.slice(9,-6)]=false;
 return {features,windows:{sandbox:'mxc'},web_search:'disabled',forced_login_method:'chatgpt',model_provider:'openai',model_providers:{},default_permissions:'creator_job',approval_policy:'never',permissions:{creator_job:{filesystem:{...plan.expected.filesystem},network:{enabled:false}}},project_doc_max_bytes:0,include_environment_context:false,history:{persistence:'none'},notify:[],sqlite_home:plan.environment.CODEX_SQLITE_HOME,log_dir:plan.environment.CODEX_SQLITE_HOME,mcp_servers:{'fake-server':{enabled:false}},plugins:{'fake@plugin':{enabled:false}}};}
function output(){return [{type:'thread.started',thread_id:randomUUID()},{type:'turn.started'},{type:'item.completed',item:{id:'result',type:'agent_message',text:JSON.stringify({version:1,summary:'Synthetic wire result',outcome:'completed',actions:[]})}},{type:'turn.completed',usage:{input_tokens:1,output_tokens:1}}].map(x=>JSON.stringify(x)+'\n');}
const contract=makeContract({taskId:'fixture',title:'Synthetic',description:'Invented text',agentId:'director',studio:'Niko'},'Synthetic profile');
const approval=()=>({id:'fixture',jobId:randomUUID(),actorType:'human' as const,actorId:'owner' as const,digest:contractDigest(contract),decision:'approved' as const,expiresAt:Date.now()+10000});
test('owner preparation produces only a salted hash and preserves the existing authentication contract',()=>{
 const password='Synthetic owner secret 42!';assert.throws(()=>ownerEnvironment(password,'different'),/CONFIRMATION_FAILED/);assert.throws(()=>ownerEnvironment('short','short'),/LENGTH_INVALID/);
 const text=ownerEnvironment(password,password);assert.match(text,/^CREATOR_OWNER_PASSWORD_HASH=scrypt:[a-f0-9]{32}:[a-f0-9]{64}\r\n$/);assert.ok(!text.includes(password));assert.notEqual(text,ownerEnvironment(password,password));const sessions=new OwnerSessions(text.trim().split('=')[1]);assert.ok(sessions.login(password,'fixture').token);
});
test('runtime configuration is optional, private, strict and rejects extra credential fields',()=>{
 assert.equal(loadRuntimeSettings(undefined),undefined);const directory=mkdtempSync(join(tmpdir(),'creator-runtime5-'));try{
  mkdirSync(join(directory,'.local'));const file=join(directory,'.local/runtime.json');writeFileSync(file,JSON.stringify({...settings,DATABASE_URL:'synthetic'}));assert.throws(()=>loadRuntimeSettings(file,directory),/CODEX_LOCAL_CONFIGURATION_INVALID/);
  assert.throws(()=>loadRuntimeSettings(join(directory,'outside.json'),directory),/CODEX_LOCAL_CONFIGURATION_INVALID/);assert.throws(()=>loadRuntimeSettings('relative.json',directory),/CODEX_LOCAL_CONFIGURATION_INVALID/);
  const synthetic={...settings,codexExecutable:join(directory,'codex.exe'),scratchRoot:join(directory,'.local/scratch'),codexHome:join(directory,'home'),systemRoot:join(directory,'system'),userProfile:join(directory,'profile')};
  for(const folder of [synthetic.scratchRoot,synthetic.codexHome,synthetic.systemRoot,synthetic.userProfile])mkdirSync(folder,{recursive:true});writeFileSync(synthetic.codexExecutable,'not executable; synthetic configuration fixture');writeFileSync(file,JSON.stringify(synthetic));assert.equal(loadRuntimeSettings(file,directory)?.expectedVersion,'0.166.0');
 }finally{assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true})}
});
test('Windows owner-directory ACL inspection fails closed on a missing path',{skip:process.platform!=='win32'},()=>{
 assert.throws(()=>assertPrivateOwnerDirectory(join(tmpdir(),'missing-owner-'+randomUUID())),/OWNER_PRIVATE_DIRECTORY_REQUIRED/);
});
test('effective isolation rejects inherited integrations, widened paths, provider overrides and writable input',()=>{
 assert.equal(isolationVerified(plan,config()),true);
 const cases=[(c:any)=>c.features.hooks=true,(c:any)=>c.plugins.unexpected={enabled:false},(c:any)=>c.mcp_servers['fake-server'].enabled=true,(c:any)=>c.permissions.creator_job.filesystem[':root']='read',(c:any)=>c.permissions.creator_job.filesystem.extra='read',(c:any)=>c.permissions.creator_job.network.enabled=true,(c:any)=>c.model_providers.custom={},(c:any)=>c.notify=['fake-hook'],(c:any)=>c.sqlite_home='wrong',(c:any)=>c.project_doc_max_bytes=1];
 for(const change of cases){const c=config();change(c);assert.equal(isolationVerified(plan,c),false)}assert.equal(isolationVerified(plan,null),false);
});
test('native protocol rehearsal verifies version, config, ChatGPT account and structured output without spawning',async()=>{
 const calls:string[]=[],launcher=protocolTestLauncher(plan,{config:config(),chunks:output(),calls});const result=await launcher.execute(contract,approval(),new AbortController().signal);assert.equal(result.summary,'Synthetic wire result');assert.deepEqual(calls,['version','initialize','initialized','config/read','account/read','exec']);
});
test('protocol failures stop before exec; approval mismatch and cancellation stop before initialization',async()=>{
 for(const fixture of [{config:config(),version:'unexpected',chunks:output()},{config:{},chunks:output()},{config:config(),accountType:'apiKey',chunks:output()},{config:config(),earlyClose:true,chunks:output()}]){const calls:string[]=[];await assert.rejects(()=>protocolTestLauncher(plan,{...fixture,calls}).execute(contract,approval(),new AbortController().signal));assert.ok(!calls.includes('exec'))}
 const calls:string[]=[],launcher=protocolTestLauncher(plan,{config:config(),chunks:output(),calls});await assert.rejects(()=>launcher.execute(contract,{...approval(),digest:'0'.repeat(64)},new AbortController().signal),/APPROVAL_INVALID/);const controller=new AbortController();controller.abort();await assert.rejects(()=>launcher.execute(contract,approval(),controller.signal),/CANCELLED/);assert.deepEqual(calls,[]);
});
test('wire errors and rejected output never become a result and are not retried',async()=>{
 for(const changes of [{chunks:['not json\n']},{chunks:output(),exitCode:7},{chunks:output(),stderr:'Reconnecting retry'},{chunks:output().slice(0,-1)},{chunks:[...output().slice(0,2),JSON.stringify({type:'item.completed',item:{id:'tool',type:'command_execution',command:'fake'}})+'\n']}]){const calls:string[]=[];await assert.rejects(()=>protocolTestLauncher(plan,{config:config(),...changes,calls}).execute(contract,approval(),new AbortController().signal));assert.equal(calls.filter(x=>x==='exec').length,1)}
 await assert.rejects(()=>new NativeCodexLauncher(settings).execute(contract,approval(),new AbortController().signal),/REAL_EXECUTION_DISABLED/);
});
test('native protocol preserves split Turkish UTF-8 and stops a hung owned stream on timeout or cancel',async()=>{
 const bytes=Buffer.from(output().join('').replace('Synthetic wire result','Türkçe çalışma özeti'));const chunks=Array.from(bytes,byte=>Buffer.from([byte]));assert.equal((await protocolTestLauncher(plan,{config:config(),chunks}).execute(contract,approval(),new AbortController().signal)).summary,'Türkçe çalışma özeti');
 const short={...contract,timeoutMs:10},shortApproval={...approval(),digest:contractDigest(short)};await assert.rejects(()=>protocolTestLauncher(plan,{config:config(),chunks:[],hang:true}).execute(short,shortApproval,new AbortController().signal),/TIMEOUT/);
 const calls:string[]=[],controller=new AbortController(),promise=protocolTestLauncher(plan,{config:config(),chunks:[],hang:true,calls}).execute(contract,approval(),controller.signal);while(!calls.includes('exec'))await new Promise(r=>setTimeout(r,1));controller.abort();await assert.rejects(()=>promise,/CANCELLED/);assert.equal(calls.filter(x=>x==='exec').length,1);
});
test('isolated PostgreSQL connects protocol rehearsal to approval and atomic worker ownership',{skip:!process.env.CREATOR_TEST_POSTGRES_BIN,timeout:120000},async()=>{
 const fixture=await isolatedPostgres(),db=fixture.client,actor={id:'owner' as const,sessionAudit:'synthetic-owner'};try{
  if(process.platform==='win32')assertPrivateOwnerDirectory(fixture.directory);
  await db.agent.create({data:{id:'director',name:'Atlas',role:'CEO',studio:'HQ',instructions:'Synthetic profile'}});const task=await db.task.create({data:{title:'Synthetic wire job',description:'Invented text',studio:'Niko',agentId:'director'}});const calls:string[]=[],jobs=new ExecutionJobs(db as unknown as JobDatabase,protocolTestLauncher(plan,{config:config(),chunks:output(),calls}));
  const job=await jobs.create(task.id,randomUUID(),actor);await assert.rejects(()=>jobs.run(job.id),/APPROVAL_STALE|ALREADY_STARTED/);assert.deepEqual(calls,[]);await jobs.decide(job.id,job.digest,'Approved',actor);
  const attempts=await Promise.allSettled([jobs.run(job.id),jobs.run(job.id)]);assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal(calls.filter(x=>x==='exec').length,1);const persisted=await jobs.get(job.id);assert.equal(persisted.source,'simulation');assert.equal(persisted.enabled,false);assert.equal(persisted.status,'completed');assert.equal(persisted.result?.summary,'Synthetic wire result');assert.equal(await db.agentReport.count({where:{sourceId:'execution:'+job.id}}),1);
 }finally{await fixture.close()}
});
