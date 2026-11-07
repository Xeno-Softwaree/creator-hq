import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {agentIds,agentPolicy,makeContract,contractDigest,verifyApproval,routeAssignment,contractSchema,type ExecutionContract} from '../execution/contract.js';
import {FakeCodexAdapter,fakeProcess,JsonlParser,executionEnvironment,codexPlan,containsSecret,type FakeProcess} from '../execution/adapter.js';
import {isolateApiTestEnvironment} from './test-environment.js';
isolateApiTestEnvironment('file:./unused-execution-test.db');
const draft={title:'Fixture script',description:'Supplied fictional brief only',agentId:'writer',studio:'Niko'};
const contract=()=>makeContract(draft);
function approval(c:ExecutionContract,id:string){return {id:randomUUID(),jobId:id,actorType:'human',actorId:'owner',digest:contractDigest(c),decision:'approved',expiresAt:Date.now()+60000};}
const transcript=(summary='Fixture output',outcome='completed')=>[JSON.stringify({type:'thread.started',thread_id:randomUUID()}),JSON.stringify({type:'turn.started'}),JSON.stringify({type:'item.completed',item:{id:'result',type:'agent_message',text:JSON.stringify({version:1,summary,outcome,actions:['Prepared text']})}}),JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}})].join('\n')+'\n';
function request(c=contract(),steps:{chunk?:string;delayMs?:number;crash?:boolean}[]=[{chunk:transcript()}]){const jobId=randomUUID();return {jobId,contract:c,loadApproval:()=>approval(c,jobId),process:fakeProcess(steps)};}

test('nine distinct versioned profiles keep owner human and studio routing bounded',()=>{
 assert.equal(new Set(agentIds.map(id=>agentPolicy(id).instruction)).size,9);
 assert.equal(agentPolicy('ceo').executable,false);
 for(const id of agentIds){const p=agentPolicy(id);assert.deepEqual(p.permissions.tools,['text']);assert.equal(p.permissions.database,'none');assert.equal(p.permissions.hooks,false);}
 assert.throws(()=>makeContract({...draft,agentId:'ceo'}));assert.throws(()=>makeContract({...draft,studio:'Son Yedek'}));
 assert.deepEqual(routeAssignment('script','Niko'),{agentId:'writer',studio:'Niko',proposedBy:'director',requiresHumanApproval:true,enabled:false});
 assert.throws(()=>routeAssignment('script','Son Yedek'));assert.equal(routeAssignment('lead','Son Yedek').agentId,'son');
});
test('approval binds exact text, instructions, agent, studio, scope and permissions; agents cannot approve',()=>{
 const c=contract(),id=randomUUID(),a=approval(c,id);assert.equal(verifyApproval(c,id,a).actorId,'owner');
 const changes=[{...c,task:{...c.task,title:'changed'}},{...c,task:{...c.task,description:'changed'}},makeContract({...draft,agentId:'niko'}),makeContract({...draft,agentId:'designer',studio:'Son Yedek'}),makeContract(draft,'Changed profile instruction'),{...c,scope:{...c.scope,studio:'Son Yedek'}},{...c,permissions:{...c.permissions,filesystem:'write'}}];
 for(const changed of changes)assert.throws(()=>verifyApproval(changed as ExecutionContract,id,a));
 for(const patch of [{actorType:'agent',actorId:'director'},{actorId:'director'},{jobId:'other'},{expiresAt:1},{decision:'rejected'}])assert.throws(()=>verifyApproval(c,id,{...a,...patch}));
 assert.equal(contractDigest(JSON.parse(JSON.stringify(c))),a.digest);assert.throws(()=>contractSchema.parse({...c,enabled:true}));
});
test('environment and Codex plan never inherit secrets, admin configuration, tools or unsafe flags',()=>{
 const parent={DATABASE_URL:'private-url',DIRECT_URL:'private-admin',PGPASSWORD:'private-password',OPENAI_API_KEY:'private-key',PATH:'untrusted',CODEX_HOME:'untrusted',NODE_OPTIONS:'untrusted'};
 assert.deepEqual(executionEnvironment(parent),{NO_COLOR:'1'});
 const plan=codexPlan(contract());assert.equal(plan.enabled,false);assert.ok(plan.arguments.includes('--ignore-user-config'));assert.ok(plan.arguments.includes('read-only'));assert.ok(plan.arguments.includes('--ephemeral'));
 assert.ok(!JSON.stringify(plan).includes('private-'));assert.ok(!plan.arguments.some(a=>/bypass|approve-for-me|add-dir|resume|workspace-write/.test(a)));
 assert.ok(plan.blockedBy.includes('WINDOWS_ISOLATION_UNVERIFIED'));
});
test('JSONL parser validates split chunks, final schema, limits and unknown tool events',()=>{
 const text=transcript(),p=new JsonlParser();const events=[...p.push(text.slice(0,35)),...p.push(text.slice(35)),...p.finish()];assert.equal(events.filter(e=>e.type==='result').length,1);assert.throws(()=>p.push('x'));
 for(const value of ['not json\n','{}\n',JSON.stringify({type:'item.completed',item:{id:'x',type:'command_execution',command:'blocked'}})+'\n',JSON.stringify({type:'item.completed',item:{id:'x',type:'agent_message',text:'{"version":1,"summary":"x","outcome":"completed","actions":[],"extra":true}'}})+'\n'])assert.throws(()=>new JsonlParser().push(value));
 assert.throws(()=>new JsonlParser().push('x'.repeat(140000)));assert.throws(()=>new JsonlParser().push('x'.repeat(33000)));
});
test('fake adapter handles success and separate approval-needed outcome without claiming real execution',async()=>{
 const adapter=new FakeCodexAdapter();const r=await adapter.execute(request());assert.equal(r.status,'completed');assert.equal(r.source,'simulation');assert.equal(r.provider,'fake_codex');assert.equal(r.enabled,false);
 const review=await adapter.execute(request(contract(),[{chunk:transcript('Review needed','needs_approval')}]));assert.equal(review.status,'awaiting_approval');
 const spoof={kind:'fake',run:async()=>0,stop:async()=>{}} as FakeProcess;await assert.rejects(adapter.execute({...request(),process:spoof}),/REAL_EXECUTION_DISABLED/);
 const owned=fakeProcess([]);assert.equal(Object.isFrozen(owned),true);assert.throws(()=>{owned.run=async()=>0});assert.throws(()=>fakeProcess([{delayMs:Infinity}]));
});
test('single active slot spans adapter instances, rejects duplicate jobs and releases after cancellation',async()=>{
 const a=new FakeCodexAdapter(),b=new FakeCodexAdapter(),r=request(contract(),[{delayMs:1000,chunk:transcript()}]),controller=new AbortController();
 const pending=a.execute({...r,signal:controller.signal});await assert.rejects(b.execute(request()),/EXECUTION_BUSY/);controller.abort();assert.equal((await pending).status,'cancelled');
 await assert.rejects(a.execute(r),/EXECUTION_DUPLICATE/);assert.equal((await b.execute(request())).status,'completed');
});
test('timeout, process crash, nonzero exit and malformed/incomplete output fail closed without retries',async()=>{
 const a=new FakeCodexAdapter();const short={...contract(),timeoutMs:10};const timeout=await a.execute(request(short,[{delayMs:1000}]));assert.equal('code' in timeout&&timeout.code,'EXECUTION_TIMEOUT');
 for(const steps of [[{crash:true}],[{chunk:'broken\n'}],[{chunk:JSON.stringify({type:'turn.completed'})+'\n'}]]){const r=await a.execute(request(contract(),steps));assert.equal(r.status,'failed');assert.deepEqual(r.events,[]);}
 const r=await a.execute({...request(),process:fakeProcess([{chunk:transcript()}],7)});assert.equal(r.status,'failed');
 const aborted=new AbortController();aborted.abort();await assert.rejects(a.execute({...request(),signal:aborted.signal}),/EXECUTION_CANCELLED/);
});
test('secret-bearing JSONL and error payloads never leave the adapter, including encoded supplied secrets',async()=>{
 const secret='fixture-pass!value',a=new FakeCodexAdapter();
 const credentialFixture=['postgresql:','//fixture:fixture@invalid/db'].join('');
 for(const summary of [secret,encodeURIComponent(secret),credentialFixture,'DATABASE_URL=fixture','Bearer fixture-only']){const r=await a.execute({...request(contract(),[{chunk:transcript(summary)}]),secrets:[secret]});assert.equal(r.status,'failed');assert.deepEqual(r.events,[]);assert.ok(!JSON.stringify(r).includes(secret));assert.ok(!JSON.stringify(r).includes('postgresql:'));}
 const escaped='fixture"private\\value';const rejected=await a.execute({...request(contract(),[{chunk:transcript(escaped)}]),secrets:[escaped]});assert.equal(rejected.status,'failed');
 assert.equal(containsSecret('Ordinary task text'),false);
});
test('studio contexts and sessions cannot be supplied or reused across jobs',async()=>{
 assert.throws(()=>makeContract({...draft,sessionId:'foreign'}));assert.throws(()=>contractSchema.parse({...contract(),scope:{...contract().scope,session:'shared'}}));
 const a=new FakeCodexAdapter(),n=await a.execute(request()),s=await a.execute(request(makeContract({...draft,agentId:'designer',studio:'Son Yedek'})));
 assert.equal(n.studio,'Niko');assert.equal(s.studio,'Son Yedek');assert.notEqual(n.events[0],s.events[0]);
 const shared=transcript();assert.equal((await a.execute(request(contract(),[{chunk:shared}]))).status,'completed');
 const reused=await a.execute(request(makeContract({...draft,agentId:'designer',studio:'Son Yedek'}),[{chunk:shared}]));assert.equal(reused.status,'failed');assert.equal('code' in reused&&reused.code,'EXECUTION_SESSION_REUSE');
});
test('preview API is read-only, authoritative about profiles, rejects escalation and has no execution endpoint',async()=>{
 const {buildApp}=await import('../app.js');const {db}=await import('../db.js');let writes=0;
 const fake={agent:{findUnique:async({where}:{where:{id:string}})=>({id:where.id,studio:agentPolicy(where.id as 'writer').studio,enabled:true,instructions:''})},task:{findUnique:async()=>null},$disconnect:async()=>{},$transaction:async()=>{writes++;throw Error('WRITE_FORBIDDEN')}};
 const app=await buildApp({database:fake as unknown as typeof db});
 try{const r=await app.inject({method:'POST',url:'/execution/preview',payload:draft});assert.equal(r.statusCode,200);assert.equal(r.json().source,'preview');assert.equal(r.json().enabled,false);assert.equal(r.json().approval.valid,false);
 const policies=await app.inject('/execution/policies');assert.equal(policies.json().profiles.length,9);
 const route=await app.inject({method:'POST',url:'/execution/route',payload:{intent:'script',studio:'Niko'}});assert.equal(route.json().agentId,'writer');assert.equal(route.json().enabled,false);
 assert.equal((await app.inject({method:'POST',url:'/execution/route',payload:{intent:'script',studio:'Son Yedek'}})).statusCode,400);
 for(const payload of [{...draft,agentId:'ceo'},{...draft,studio:'Son Yedek'},{...draft,permissions:{filesystem:'write'}},{...draft,title:'DATABASE_URL=private-fixture'},{...draft,'private-fixture':'unrecognized secret-bearing key'},{...draft,taskId:'missing'}]){const res=await app.inject({method:'POST',url:'/execution/preview',payload});assert.ok(res.statusCode>=400);assert.ok(!res.body.includes('private-fixture'));}
 assert.equal((await app.inject({method:'POST',url:'/execution/start',payload:{}})).statusCode,404);assert.equal(writes,0);
 }finally{await app.close()}
});
