import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {NATIVE_EXECUTION_JOB_ID,NATIVE_EXECUTION_RELEASE_APPROVED,permitsNativeJob} from '../execution/release.js';
import {ExecutionJobs,JobFailure,type JobDatabase} from '../execution/jobs.js';
import {NativeCodexLauncher,fakeJobLauncher,fakeTextProcess} from '../execution/launcher.js';
import {fakeProcess} from '../execution/adapter.js';
import {makeContract} from '../execution/contract.js';
import {isolatedPostgres} from './execution-test-fixture.js';
import {isolateApiTestEnvironment} from './test-environment.js';
isolateApiTestEnvironment('file:./unused-single-job.db');

test('single-job release requires both approval and an exact valid reserved UUID',()=>{
 assert.equal(NATIVE_EXECUTION_RELEASE_APPROVED,false);
 assert.equal(permitsNativeJob(NATIVE_EXECUTION_JOB_ID),false);
 assert.equal(permitsNativeJob(NATIVE_EXECUTION_JOB_ID,true),true);
 for(const selected of [null,'','invalid','*'])assert.equal(permitsNativeJob(NATIVE_EXECUTION_JOB_ID,true,selected),false);
 for(const id of [randomUUID(),'',NATIVE_EXECUTION_JOB_ID.toUpperCase()])assert.equal(permitsNativeJob(id,true),false);
 assert.equal(makeContract({title:'Synthetic',agentId:'director',studio:'HQ'},'').timeoutMs,30000);
});

test('closed native gate rejects selected and unrelated jobs with 423 before any database access',async()=>{
 const jobs=new ExecutionJobs({} as JobDatabase,new NativeCodexLauncher());
 for(const id of [NATIVE_EXECUTION_JOB_ID,randomUUID()])await assert.rejects(()=>jobs.claim(id),(e:unknown)=>e instanceof JobFailure&&e.status===423&&e.code==='REAL_EXECUTION_DISABLED');
});

test('fake-only single-job rehearsal preserves ownership, terminal attempts and rejection of every other job',{skip:!process.env.CREATOR_TEST_POSTGRES_BIN,timeout:120000},async t=>{
 const fixture=await isolatedPostgres(),db=fixture.client,actor={id:'owner' as const,sessionAudit:'synthetic'};
 try{
  await db.agent.create({data:{id:'director',name:'Atlas',role:'CEO',studio:'HQ'}});
  for(const outcome of ['success','crash','timeout'] as const)await t.test(outcome,async()=>{
   const selected=randomUUID();let calls=0;
   const launcher=fakeJobLauncher(()=>{calls++;return outcome==='success'?fakeTextProcess():fakeProcess(outcome==='crash'?[{crash:true}]:[{delayMs:31000}]);});
   // Only this test harness evaluates the approved branch; production remains code-locked.
   class Rehearsal extends ExecutionJobs {override async claim(id:string){if(!permitsNativeJob(id,true,selected))throw new JobFailure('REAL_EXECUTION_DISABLED',423);return super.claim(id);}}
   const jobs=new Rehearsal(db as unknown as JobDatabase,launcher);
   const task=await db.task.create({data:{title:'Synthetic '+outcome,studio:'HQ',agentId:'director'}});
   const job=await jobs.create(task.id,selected,actor),other=await jobs.create(task.id,randomUUID(),actor);
   await jobs.decide(job.id,job.digest,'Approved',actor);await jobs.decide(other.id,other.digest,'Approved',actor);
   await assert.rejects(()=>jobs.run(other.id),(e:unknown)=>e instanceof JobFailure&&e.status===423);
   const results=await Promise.allSettled([jobs.run(selected),jobs.run(selected)]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
   assert.equal((await jobs.get(selected)).status,outcome==='success'?'completed':'failed');
   await assert.rejects(()=>jobs.run(selected));await assert.rejects(()=>jobs.run(other.id),(e:unknown)=>e instanceof JobFailure&&e.status===423);
   assert.equal(calls,1);assert.equal((await jobs.get(other.id)).status,'planned');
  });
 }finally{await fixture.close()}
});
