import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, closeSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {isolateApiTestEnvironment} from './database/test-environment.js';
// An isolated temporary database; never touches the user's workspace records.
const dir=mkdtempSync(join(tmpdir(),'creator-hq-test-'));
isolateApiTestEnvironment('file:'+join(dir,'test.db').replaceAll('\\','/'));
closeSync(openSync(join(dir,'test.db'),'wx'));
test('persistent local API workflow and safety boundaries',async()=>{
 try {
 execFileSync(process.execPath,[resolve('../../node_modules/prisma/build/index.js'),'db','push','--skip-generate'],{env:process.env,stdio:'pipe'});
 const {buildApp}=await import('./app.js');const {db}=await import('./db.js');
 await db.agent.createMany({data:[{id:'niko',name:'Niko',role:'Lead',studio:'Niko'},{id:'son',name:'Son',role:'Lead',studio:'Son Yedek'}]});
 await db.studioSettings.createMany({data:[{id:'Niko',contentLanguage:'en-US'},{id:'Son Yedek',contentLanguage:'tr-TR'}]});
 const baseline=await db.agent.findMany({orderBy:{id:'asc'}});
 const app=await buildApp();
 try {
 assert.equal((await app.inject({method:'GET',url:'/health'})).json().execution,'disabled');
 const failed=await buildApp({database:{$queryRaw:async()=>{throw {code:'P1001',message:'must-not-leak-secret'}},$disconnect:async()=>{}} as unknown as typeof db});
 const failure=await failed.inject({method:'GET',url:'/health'});assert.equal(failure.statusCode,503);assert.equal(failure.json().code,'DATABASE_UNAVAILABLE');assert.ok(!failure.body.includes('must-not-leak-secret'));await failed.close();
 process.env.DATABASE_READ_ONLY='true';assert.equal((await app.inject({method:'POST',url:'/simulate'})).json().code,'MIGRATION_READ_ONLY');delete process.env.DATABASE_READ_ONLY;
 
 const turkish=(await app.inject({method:'GET',url:'/state',headers:{'accept-language':'tr-TR'}})).json();
 const english=(await app.inject({method:'GET',url:'/state',headers:{'accept-language':'en-US'}})).json();
 assert.deepEqual(turkish.agents,english.agents);assert.deepEqual(await db.agent.findMany({orderBy:{id:'asc'}}),baseline);
 assert.equal(turkish.studioSettings.find((s:{id:string})=>s.id==='Niko').contentLanguage,'en-US');
 assert.equal(english.studioSettings.find((s:{id:string})=>s.id==='Son Yedek').contentLanguage,'tr-TR');
 assert.equal((await app.inject({method:'PATCH',url:'/studios/Niko',payload:{contentLanguage:'fr-FR'}})).statusCode,400);
 assert.equal((await app.inject({method:'PATCH',url:'/studios/Niko',payload:{contentLanguage:'tr-TR'}})).statusCode,200);
 assert.equal((await db.studioSettings.findUniqueOrThrow({where:{id:'Niko'}})).contentLanguage,'tr-TR');
 await app.inject({method:'PATCH',url:'/studios/Niko',payload:{contentLanguage:'en-US'}});
 const invalid=await app.inject({method:'POST',url:'/tasks',payload:{title:''}});assert.equal(invalid.json().code,'VALIDATION_ERROR');
 
 assert.equal((await app.inject({method:'POST',url:'/tasks',payload:{title:' '}})).statusCode,400);
 assert.equal((await app.inject({method:'POST',url:'/tasks',headers:{origin:'https://untrusted.example'},payload:{}})).statusCode,403);
 assert.equal((await app.inject({method:'POST',url:'/tasks',payload:{title:'Wrong studio',studio:'Niko',agentId:'son'}})).statusCode,400);
 const created=await app.inject({method:'POST',url:'/tasks',payload:{title:'Test concept',studio:'Niko',agentId:'niko'}});assert.equal(created.statusCode,201);const id=created.json().id;
 assert.equal((await app.inject({method:'PATCH',url:'/tasks/'+id,payload:{status:'Review',description:'Ready for review'}})).statusCode,200);
 assert.equal((await db.task.findUniqueOrThrow({where:{id}})).status,'Review');
 await app.inject({method:'PATCH',url:'/tasks/'+id,payload:{status:'Done'}});
 const manual=await db.agentReport.findFirstOrThrow({where:{taskId:id}});assert.equal(manual.source,'manual');assert.equal(JSON.parse(manual.summaryData).title,'Test concept');assert.equal(JSON.parse(manual.originalTechnicalReport).execution,'disabled');
 await app.inject({method:'PATCH',url:'/tasks/'+id,payload:{status:'Done'}});assert.equal(await db.agentReport.count({where:{taskId:id}}),1);
 await app.inject({method:'PATCH',url:'/tasks/'+id,payload:{status:'Review'}});
 
 assert.equal((await app.inject({method:'PATCH',url:'/tasks/'+id,payload:{status:'Published'}})).statusCode,400);
 assert.equal((await app.inject({method:'PATCH',url:'/agents/niko',payload:{name:'New Niko',role:'Director',instructions:'Test',enabled:true}})).statusCode,200);
 const simulation=await app.inject({method:'POST',url:'/simulate'});assert.equal(simulation.statusCode,200);const sim=simulation.json();assert.equal(sim.simulated,true);
 const report=await db.agentReport.findFirstOrThrow({where:{approvalId:sim.id}});const original=report.originalTechnicalReport;assert.equal(report.status,'awaiting_approval');assert.equal(report.source,'simulation');
 const approved=await app.inject({method:'PATCH',url:'/approvals/'+sim.id,payload:{status:'Approved'}});assert.equal(approved.json().execution,'disabled');
 const after=await db.agentReport.findUniqueOrThrow({where:{id:report.id}});assert.equal(after.originalTechnicalReport,original);assert.equal(after.status,'completed');
 const {disabledCeoAdapter}=await import('./reports.js');assert.equal(disabledCeoAdapter.enabled,false);assert.equal(disabledCeoAdapter.authenticated,false);await assert.rejects(()=>disabledCeoAdapter.summarize({originalTechnicalReport:original,locale:'tr-TR'}),/CODEX_RUNTIME_DISABLED/);
 
 assert.equal((await app.inject({method:'PATCH',url:'/approvals/'+sim.id,payload:{status:'Rejected'}})).statusCode,409);
 const state=(await app.inject({method:'GET',url:'/state'})).json();assert.equal(state.tasks[0].description,'Ready for review');assert.ok(state.activity.some((a:{simulated:boolean})=>a.simulated));assert.ok(state.integrations.every((a:{enabled:boolean})=>!a.enabled));
 await db.$disconnect();await db.$connect();assert.equal((await db.task.findUniqueOrThrow({where:{id}})).title,'Test concept');
 assert.equal((await app.inject({method:'DELETE',url:'/tasks/'+id})).statusCode,204);
 assert.equal((await app.inject({method:'PATCH',url:'/tasks/'+id,payload:{title:'Missing'}})).statusCode,404);
 } finally {await app.close()}
 } finally {rmSync(dir,{recursive:true,force:true})}
});
