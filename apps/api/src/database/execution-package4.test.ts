import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ownerPasswordHash,OwnerSessions} from '../execution/owner.js';
import {ExecutionJobs,type JobDatabase,JobFailure} from '../execution/jobs.js';
import {NativeCodexLauncher,fakeJobLauncher,fakeTextProcess,integrationOverride,runtimePlan} from '../execution/launcher.js';
import {makeContract} from '../execution/contract.js';
import {fakeProcess} from '../execution/adapter.js';
import {isolateApiTestEnvironment} from './test-environment.js';
import {isolatedPostgres} from './execution-test-fixture.js';
isolateApiTestEnvironment('file:./unused-package4.db');
const password='Synthetic owner password 42!',actor={id:'owner' as const,sessionAudit:'isolated-session'};
test('owner sessions require configured password, CSRF, expiration and new authentication after restart',()=>{
 assert.throws(()=>new OwnerSessions(undefined).login(password,'fixture'),/UNCONFIGURED/);let clock=1000;const hash=ownerPasswordHash(password),sessions=new OwnerSessions(hash,()=>clock);
 for(let i=0;i<5;i++)assert.throws(()=>sessions.login('wrong-password','bad'),/AUTH_FAILED/);assert.throws(()=>sessions.login(password,'bad'),/RATE_LIMITED/);
 const s=sessions.login(password,'good'),cookie='creator_owner='+s.token;assert.equal(sessions.authenticate(cookie,s.csrf,true).owner.id,'owner');assert.throws(()=>sessions.authenticate(cookie,'forged',true),/CSRF_INVALID/);
 assert.throws(()=>new OwnerSessions(hash).authenticate(cookie),/AUTH_REQUIRED/);clock+=3600001;assert.throws(()=>sessions.authenticate(cookie),/AUTH_REQUIRED/);
});
test('launcher configuration rejects unsafe IDs and paths, excludes inherited credentials and remains locked',async()=>{
 assert.equal(integrationOverride('mcp_servers','safe-id'),'mcp_servers.safe-id.enabled=false');for(const id of ['"quoted"','bad.id','x\ny',''])assert.throws(()=>integrationOverride('plugins',id),/IDENTIFIER_INVALID/);
 const root=process.cwd(),settings={codexExecutable:root+'/fake.exe',scratchRoot:root+'/scratch',codexHome:root+'/fake-home',nodeExecutable:process.execPath,mcpIds:['safe-id'],pluginIds:['plugin@safe'],systemRoot:root+'/system',userProfile:root+'/profile'};
 const plan=runtimePlan(settings,root+'/scratch/job',root+'/scratch/state');assert.ok(plan.args.includes('mcp_servers.safe-id.enabled=false'));assert.ok(!plan.args.some(x=>x.includes('accept_invalid')||x.includes('dangerously')));
 for(const key of ['DATABASE_URL','DIRECT_URL','OPENAI_API_KEY','NODE_OPTIONS','CREATOR_OWNER_PASSWORD_HASH'])assert.equal((plan.environment as any)[key],undefined);
 assert.throws(()=>runtimePlan(settings,root+'/outside',root+'/scratch/state'),/BOUNDARY_INVALID/);
 const c=makeContract({taskId:'fixture',title:'Fake',description:'Text only',agentId:'director',studio:'HQ'},'Fake Atlas');await assert.rejects(()=>new NativeCodexLauncher().execute(c,{} as any,new AbortController().signal),/REAL_EXECUTION_DISABLED/);
 assert.throws(()=>new ExecutionJobs({} as JobDatabase,{kind:'fake',execute:async()=>({version:1,summary:'fake',actions:[],outcome:'completed'})}),/FAKE_TEST_ONLY/);
});
test('isolated PostgreSQL: persistent authenticated jobs, approval binding and worker ownership',{skip:!process.env.CREATOR_TEST_POSTGRES_BIN,timeout:120000},async t=>{
 const fixture=await isolatedPostgres();const db=fixture.client;const {buildApp}=await import('../app.js');const {db:defaultDb}=await import('../db.js');
 const launcher=fakeJobLauncher(()=>fakeTextProcess()),jobs=new ExecutionJobs(db as unknown as JobDatabase,launcher);let app=await buildApp({database:db as unknown as typeof defaultDb,provider:'postgresql',executionLauncher:launcher,ownerPasswordHash:ownerPasswordHash(password)});
 const origin={origin:'http://127.0.0.1:3000'};let headers:Record<string,string>={};
 const task=async(title='Synthetic Atlas task')=>db.task.create({data:{title,description:'Invented text',studio:'Niko',agentId:'director'}});
 const approved=async()=>{const taskRow=await task(),job=await jobs.create(taskRow.id,randomUUID(),actor);await jobs.decide(job.id,job.digest,'Approved',actor);return job};
 try{
 await db.agent.create({data:{id:'director',name:'Atlas',role:'CEO',studio:'HQ',instructions:'Synthetic coordinator'}});
 await t.test('HTTP authentication, origin and CSRF gates cannot be forged',async()=>{
  assert.equal((await app.inject({method:'GET',url:'/execution/jobs'})).statusCode,401);
  assert.equal((await app.inject({method:'POST',url:'/execution/session',payload:{password}})).statusCode,403);
  const login=await app.inject({method:'POST',url:'/execution/session',headers:origin,payload:{password}});assert.equal(login.statusCode,200);assert.match(String(login.headers['set-cookie']),/HttpOnly; SameSite=Strict/);
  headers={...origin,cookie:String(login.headers['set-cookie']).split(';')[0],'x-creator-csrf':login.json().csrf};
  const taskRow=await task();const requestId=randomUUID();const forbidden=await app.inject({method:'POST',url:'/execution/jobs',headers:{...headers,'x-creator-csrf':'forged'},payload:{taskId:taskRow.id,requestId}});assert.equal(forbidden.statusCode,401);
  assert.equal((await app.inject({method:'POST',url:'/execution/jobs',headers,payload:{taskId:taskRow.id,requestId,actor:'owner'}})).statusCode,400);
  const created=await app.inject({method:'POST',url:'/execution/jobs',headers,payload:{taskId:taskRow.id,requestId}});assert.equal(created.statusCode,201);const job=created.json();
  assert.equal((await app.inject({method:'PATCH',url:'/approvals/'+job.approval.id,payload:{status:'Approved'}})).statusCode,403);
  const result=await app.inject({method:'POST',url:'/execution/jobs/'+job.id+'/decision',headers,payload:{decision:'Approved',digest:job.digest}});assert.equal(result.statusCode,200);assert.equal(result.json().approval.actor,'owner');
  const done=await app.inject({method:'POST',url:'/execution/jobs/'+job.id+'/start',headers});assert.equal(done.statusCode,200);assert.equal(done.json().source,'simulation');assert.equal(done.json().status,'completed');assert.ok(done.json().result.summary);assert.ok(!JSON.stringify(done.json()).includes('sessionAudit'));
 });
 await t.test('request IDs are idempotent and job/approval creation rolls back atomically',async()=>{
  const taskRow=await task(),id=randomUUID();const results=await Promise.all([jobs.create(taskRow.id,id,actor),jobs.create(taskRow.id,id,actor)]);assert.equal(results[0].id,results[1].id);assert.equal(await db.executionJob.count({where:{id}}),1);
  const other=await task();await assert.rejects(()=>jobs.create(other.id,id,actor),/REQUEST_CONFLICT/);
  const broken:JobDatabase={$queryRawUnsafe:db.$queryRawUnsafe.bind(db),$executeRawUnsafe:db.$executeRawUnsafe.bind(db),$transaction:fn=>db.$transaction(tx=>fn({$queryRawUnsafe:tx.$queryRawUnsafe.bind(tx),$executeRawUnsafe:async(sql,...args)=>{if(sql.startsWith('INSERT INTO creator_hq."ExecutionJob"'))throw Error('SYNTHETIC_FAILURE');return tx.$executeRawUnsafe(sql,...args)}}))};
  const failedId=randomUUID();await assert.rejects(()=>new ExecutionJobs(broken,launcher).create(taskRow.id,failedId,actor),/SYNTHETIC_FAILURE/);assert.equal(await db.approval.count({where:{id:'execution:'+failedId}}),0);
 });
 await t.test('concurrent decisions and workers have exactly one owner across service instances',async()=>{
  const taskRow=await task(),job=await jobs.create(taskRow.id,randomUUID(),actor);const decisions=await Promise.allSettled([jobs.decide(job.id,job.digest,'Approved',actor),jobs.decide(job.id,job.digest,'Approved',actor)]);assert.equal(decisions.filter(x=>x.status==='fulfilled').length,1);
  const other=await approved(),second=new ExecutionJobs(db as unknown as JobDatabase,launcher);const claims=await Promise.allSettled([jobs.claim(job.id),second.claim(other.id)]);assert.equal(claims.filter(x=>x.status==='fulfilled').length,1);
  const claimed=(claims.find(x=>x.status==='fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof jobs.claim>>>).value;
  await assert.rejects(()=>jobs.complete(claimed.id,randomUUID(),null),/OWNERSHIP_LOST/);
  const result={version:1,summary:'Fake result',actions:[],outcome:'completed'};await jobs.complete(claimed.id,claimed.metadata.worker!.token,result);await assert.rejects(()=>jobs.complete(claimed.id,claimed.metadata.worker!.token,result),/OWNERSHIP_LOST/);
  assert.equal(await db.agentReport.count({where:{sourceId:'execution:'+claimed.id}}),1);assert.equal((await db.task.findUniqueOrThrow({where:{id:claimed.taskId}})).status,'Review');
 });
 await t.test('task and profile edits invalidate approval permanently, including edit then restore',async()=>{
  const job=await approved();const original=await db.task.findUniqueOrThrow({where:{id:job.taskId}});
  assert.equal((await app.inject({method:'PATCH',url:'/tasks/'+job.taskId,payload:{description:'Changed'}})).statusCode,200);assert.equal((await app.inject({method:'PATCH',url:'/tasks/'+job.taskId,payload:{description:original.description}})).statusCode,200);
  assert.equal((await jobs.get(job.id)).approval.valid,false);await assert.rejects(()=>jobs.claim(job.id),/ALREADY_STARTED/);
  const another=await approved();assert.equal((await app.inject({method:'PATCH',url:'/agents/director',payload:{name:'Atlas',role:'CEO',instructions:'Changed role instructions',enabled:true}})).statusCode,200);assert.equal((await jobs.get(another.id)).approval.valid,false);
 });
 await t.test('cancellation, rejected secrets, expiry and crash do not commit results or retry',async()=>{
  const cancelled=await approved(),claim=await jobs.claim(cancelled.id);await jobs.cancel(cancelled.id,actor);assert.equal((await jobs.complete(claim.id,claim.metadata.worker!.token,{version:1,summary:'Fake',actions:[],outcome:'completed'})).status,'cancelled');assert.equal(await db.agentReport.count({where:{sourceId:'execution:'+claim.id}}),0);
  const secret=await approved(),owned=await jobs.claim(secret.id);assert.equal((await jobs.complete(secret.id,owned.metadata.worker!.token,{version:1,summary:'postgresql:'+'//user:synthetic@invalid.test/postgres',actions:[],outcome:'completed'})).error,'EXECUTION_RESULT_REJECTED');
  const expired=await approved();await db.$executeRawUnsafe('UPDATE creator_hq."ExecutionJob" SET metadata=jsonb_set(metadata,\'{approval,expiresAt}\',\'"2000-01-01T00:00:00.000Z"\'::jsonb) WHERE id=$1',expired.id);await assert.rejects(()=>jobs.claim(expired.id),/APPROVAL_STALE/);
  let attempts=0;const crashJobs=new ExecutionJobs(db as unknown as JobDatabase,fakeJobLauncher(()=>{attempts++;return fakeProcess([{crash:true}])}));const crashed=await approved();assert.equal((await crashJobs.run(crashed.id)).status,'failed');await assert.rejects(()=>crashJobs.run(crashed.id));assert.equal(attempts,1);
 });
 await t.test('expired worker cannot complete or be automatically replaced',async()=>{
  const job=await approved(),owned=await jobs.claim(job.id);await db.$executeRawUnsafe('UPDATE creator_hq."ExecutionJob" SET metadata=jsonb_set(metadata,\'{worker,leaseUntil}\',\'"2000-01-01T00:00:00.000Z"\'::jsonb) WHERE id=$1',job.id);
  assert.equal((await jobs.get(job.id)).leaseExpired,true);const next=await approved();await assert.rejects(()=>jobs.claim(next.id),/WORKER_BUSY/);await assert.rejects(()=>jobs.complete(job.id,owned.metadata.worker!.token,null),/OWNERSHIP_LOST/);assert.equal((await jobs.get(job.id)).status,'running');assert.equal(await db.agentReport.count({where:{sourceId:'execution:'+job.id}}),0);
  // Isolated fixture cleanup only; production recovery is deliberately not automated.
  await db.executionJob.update({where:{id:job.id},data:{status:'failed'}});
 });
 await t.test('job-store outage returns sanitized 503 and does not queue approval or job writes',async()=>{
  const count=await db.executionJob.count(),unavailable=Object.assign(Error('Synthetic unavailability'),{code:'P1001'});
  const failing={$connect:async()=>{},$disconnect:async()=>{},$transaction:async()=>{throw unavailable}};
  const offline=await buildApp({database:failing as unknown as typeof defaultDb,provider:'postgresql',ownerPasswordHash:ownerPasswordHash(password)});
  try{const login=await offline.inject({method:'POST',url:'/execution/session',headers:origin,payload:{password}}),h={...origin,cookie:String(login.headers['set-cookie']).split(';')[0],'x-creator-csrf':login.json().csrf};const taskRow=await task();const response=await offline.inject({method:'POST',url:'/execution/jobs',headers:h,payload:{taskId:taskRow.id,requestId:randomUUID()}});assert.equal(response.statusCode,503);assert.equal(response.json().code,'DATABASE_UNAVAILABLE');assert.ok(!response.body.includes('Synthetic'));}finally{await offline.close()}assert.equal(await db.executionJob.count(),count);await jobs.list();assert.equal(await db.executionJob.count(),count);
 });
 await t.test('production launcher refuses execution and DB enabled=false constraint remains enforced',async()=>{
  const blocked=new ExecutionJobs(db as unknown as JobDatabase,new NativeCodexLauncher()),taskRow=await task(),job=await blocked.create(taskRow.id,randomUUID(),actor);await blocked.decide(job.id,job.digest,'Approved',actor);
  await assert.rejects(()=>blocked.run(job.id),(e:unknown)=>e instanceof JobFailure&&e.status===423);assert.equal((await blocked.get(job.id)).status,'planned');assert.equal((await blocked.get(job.id)).source,'codex');assert.equal((await blocked.get(job.id)).result,null);
  await assert.rejects(()=>db.$executeRawUnsafe('UPDATE creator_hq."ExecutionJob" SET enabled=true WHERE id=$1',job.id));assert.equal((await db.executionJob.findUniqueOrThrow({where:{id:job.id}})).enabled,false);
 });
 await t.test('API restart preserves jobs and results but requires a fresh human session',async()=>{
  const before=await jobs.list();await app.close();app=await buildApp({database:db as unknown as typeof defaultDb,provider:'postgresql',executionLauncher:launcher,ownerPasswordHash:ownerPasswordHash(password)});assert.equal((await app.inject({method:'GET',url:'/execution/jobs',headers})).statusCode,401);
  const login=await app.inject({method:'POST',url:'/execution/session',headers:origin,payload:{password}});headers={...origin,cookie:String(login.headers['set-cookie']).split(';')[0],'x-creator-csrf':login.json().csrf};const after=await app.inject({method:'GET',url:'/execution/jobs',headers});assert.equal(after.statusCode,200);assert.deepEqual(after.json().jobs.map((j:any)=>[j.id,j.status,j.result]),before.map(j=>[j.id,j.status,j.result]));
 });
 }finally{await app.close();await fixture.close()}
});
