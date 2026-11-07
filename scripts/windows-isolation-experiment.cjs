// Local sentinel-only experiment. Never invokes exec, a model, a real auth file or global setup.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),net=require('node:net'),{spawn}=require('node:child_process');
const base=fs.mkdtempSync(path.join(os.tmpdir(),'creator-hq-isolation-'));
const job=path.join(base,'job'),home=path.join(base,'fake-codex-home'),blocked=path.join(base,'protected');
for(const p of [job,home,blocked,path.join(base,'temp')])fs.mkdirSync(p,{recursive:true});
const write=(p,v)=>fs.writeFileSync(p,v,{flag:'wx'});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const allowed=path.join(job,'brief.txt'),denied=path.join(blocked,'sentinel.txt'),auth=path.join(home,'auth.json'),marker=path.join(base,'hook-marker.txt');
write(allowed,'SYNTHETIC BRIEF ONLY');write(denied,'SYNTHETIC PRIVATE SENTINEL');write(auth,JSON.stringify({OPENAI_API_KEY:'fixture-not-a-real-credential'}));
write(path.join(home,'hooks.json'),JSON.stringify({hooks:{SessionStart:[{hooks:[{type:'command',command:'fixture-command-never-run'}]}]}}));
const q=p=>JSON.stringify(p.replaceAll('\\','/'));
const config=`default_permissions = "sentinel"\napproval_policy = "never"\n[windows]\nsandbox = "mxc"\n[permissions.sentinel.filesystem]\n":root" = "deny"\n":minimal" = "read"\n${q(job)} = "read"\n${q(path.dirname(process.execPath))} = "read"\n${q(blocked)} = "deny"\n${q(home)} = "deny"\n[permissions.sentinel.network]\nenabled = false\n[mcp_servers.sentinel]\ncommand = "fixture-mcp-must-not-launch"\nenabled = false\n`;
write(path.join(home,'config.toml'),config);
const probe=path.join(job,'probe.cjs');
write(probe,`const fs=require('fs'),net=require('net');const a=JSON.parse(process.argv[2]);const r={};
function access(name,fn){try{fn();r[name]=true}catch(e){r[name]=false;r[name+'Error']=['EACCES','EPERM','ENOENT'].includes(e.code)?e.code:'OTHER'}}
access('allowedRead',()=>fs.readFileSync(a.allowed));access('protectedRead',()=>fs.readFileSync(a.denied));access('authRead',()=>fs.readFileSync(a.auth));access('workspaceWrite',()=>fs.writeFileSync(a.write,'SYNTHETIC WRITE'));access('protectedWrite',()=>fs.writeFileSync(a.deniedWrite,'SYNTHETIC WRITE'));
r.realEnvironmentAbsent=['DATABASE_URL','DIRECT_URL','PGPASSWORD','OPENAI_API_KEY','CODEX_API_KEY','NODE_OPTIONS'].every(k=>!process.env[k]);
function connect(host,port){return new Promise(resolve=>{const s=net.connect({host,port});s.setTimeout(1200);let done=false;function end(connected,code){if(done)return;done=true;s.destroy();resolve({connected,code})}s.on('connect',()=>end(true,'CONNECTED'));s.on('error',e=>end(false,['EACCES','EPERM','ECONNREFUSED','ENETUNREACH','EHOSTUNREACH'].includes(e.code)?e.code:'OTHER'));s.on('timeout',()=>end(false,'TIMEOUT'))})}
(async()=>{const local=await connect('127.0.0.1',a.port);r.loopbackConnected=local.connected;r.loopbackError=local.code;const external=await connect('192.0.2.1',9);r.externalConnected=external.connected;r.externalError=external.code;console.log(JSON.stringify(r))})();`);
const env={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,PATH:path.dirname(process.execPath),TEMP:path.join(base,'temp'),TMP:path.join(base,'temp'),USERPROFILE:home,HOME:home,APPDATA:home,LOCALAPPDATA:home,CODEX_HOME:home,NO_COLOR:'1'};
const report={modelCalls:0,globalConfigurationChanged:false,systemSetupRequested:false,root:base,mode:'mxc',scope:'synthetic_sentinels_only',productionExecutionReady:false,checks:{},limitations:[]};
let server;
async function run(exe,args){return new Promise(resolve=>{const child=spawn(exe,args,{cwd:job,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='',limited=false;const timer=setTimeout(()=>{limited=true;child.kill()},30000);child.stdout.on('data',v=>{out+=v;if(out.length>65536){limited=true;child.kill()}});child.stderr.on('data',v=>{err+=v;if(err.length>65536){limited=true;child.kill()}});child.on('error',()=>{clearTimeout(timer);resolve({code:null,out:'',err:'SPAWN_ERROR'})});child.on('close',code=>{clearTimeout(timer);resolve({code,out:out.slice(0,65536),err:err.slice(0,65536),limited})})})}
(async()=>{
 const codex=process.argv[2];if(!codex||path.basename(codex)!=='codex.exe'||!fs.existsSync(codex))throw Error('NATIVE_CODEX_REQUIRED');
 server=net.createServer(s=>s.end());await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r)});
 const payload={allowed,denied,auth,write:path.join(job,'write-test.txt'),deniedWrite:path.join(blocked,'write-test.txt'),port:server.address().port};
 const probeArgs=['--eval',fs.readFileSync(probe,'utf8'),'probe',JSON.stringify(payload)];
 const control=await run(process.execPath,probeArgs);const c=JSON.parse(control.out.trim());
 report.checks.positiveControl=c.allowedRead&&c.protectedRead&&c.authRead&&c.workspaceWrite&&c.protectedWrite&&c.loopbackConnected&&c.realEnvironmentAbsent;
 for(const p of [payload.write,payload.deniedWrite])fs.unlinkSync(p);
 if(!report.checks.positiveControl)throw Error('CONTROL_FAILED');
 const before=[allowed,denied,auth,path.join(home,'config.toml'),path.join(home,'hooks.json')].map(hash);
 const r=await run(codex,['-c','windows.sandbox="mxc"','sandbox','--permission-profile','sentinel','--cd',job,'--',process.execPath,...probeArgs]);
 write(path.join(base,'sandbox-diagnostic.txt'),r.err+'\n'+r.out);
 report.exitCode=r.code;
 if(r.code===0){let result;try{result=JSON.parse(r.out.trim().split(/\r?\n/).at(-1))}catch{throw Error('PROBE_OUTPUT_INVALID')}
  report.probe=result;report.checks.allowedRead=result.allowedRead;report.checks.protectedReadDenied=!result.protectedRead;report.checks.fakeAuthReadDenied=!result.authRead;report.checks.workspaceWriteDenied=!result.workspaceWrite;report.checks.protectedWriteDenied=!result.protectedWrite;report.checks.loopbackDenied=!result.loopbackConnected&&['EACCES','EPERM'].includes(result.loopbackError);report.checks.externalPermissionDenied=!result.externalConnected&&['EACCES','EPERM'].includes(result.externalError);report.checks.environment=result.realEnvironmentAbsent;
 }else{report.failureCategory=/not supported|not available|unsupported|capabilit/i.test(r.err)?'MXC_UNAVAILABLE':/access.*denied|os error 5|Erişim/i.test(r.err)?'SANDBOX_ACCESS_DENIED':'SANDBOX_STARTUP_FAILED';report.limitations.push('Sentinel command did not complete; denied access is not proven. No fallback or elevated setup attempted.');}
 report.checks.sentinelBytesUnchanged=[allowed,denied,auth,path.join(home,'config.toml'),path.join(home,'hooks.json')].every((p,i)=>hash(p)===before[i]);
 report.checks.noWritesCreated=!fs.existsSync(payload.write)&&!fs.existsSync(payload.deniedWrite);
 report.checks.noHookMarker=!fs.existsSync(marker);
 // Listing configuration does not trigger hooks or a model and is not a runtime hook-denial proof.
 const m=await run(codex,['mcp','list','--json']);write(path.join(base,'mcp-diagnostic.txt'),m.err+'\n'+m.out);
 try{const list=JSON.parse(m.out);report.checks.onlySyntheticDisabledMcp=m.code===0&&Array.isArray(list)&&list.length===1&&list[0].name==='sentinel'&&list[0].enabled===false;}catch{report.checks.onlySyntheticDisabledMcp=false;}
 report.limitations.push('Fake CODEX_HOME only; actual user configuration and credentials were not inspected. Runtime hook suppression, all network protocols/destinations and real CLI model execution are not proven by these tests.');
 report.passed=Object.values(report.checks).every(Boolean)&&r.code===0;
})().catch(e=>{report.passed=false;report.failureCategory=/^[A-Z_]+$/.test(e.message)?e.message:'EXPERIMENT_FAILED'}).finally(async()=>{if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(base,'result.json'),JSON.stringify(report,null,2));fs.mkdirSync('.local/phase20-package2',{recursive:true});fs.writeFileSync('.local/phase20-package2/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1});
