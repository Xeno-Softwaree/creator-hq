import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHealthProbe,healthBudgetMs} from './health.js';
import {isolateApiTestEnvironment} from './test-environment.js';
isolateApiTestEnvironment('file:./unused-health-fixture.db');
test('health budget accounts for connect, pool and query bounds without exposing URLs',()=>{
 const url=new URL('postgresql://localhost/postgres');for(const [k,v] of Object.entries({connect_timeout:'10',pool_timeout:'10',socket_timeout:'20'}))url.searchParams.set(k,v);
 assert.equal(healthBudgetMs({DATABASE_PROVIDER:'postgresql',DATABASE_URL:url.toString()}),40000);
 assert.equal(healthBudgetMs({HEALTH_TIMEOUT_MS:'12000'}),12000);
 for(const v of ['0','-1','60001','NaN'])assert.throws(()=>healthBudgetMs({HEALTH_TIMEOUT_MS:v}),/INVALID_HEALTH_TIMEOUT/);
});
test('health deadline covers connection and query, deduplicates pending reads and recovers',async()=>{
 let release!:()=>void,calls=0;
 const stalled=new Promise<void>(resolve=>{release=resolve});
 const probe=createHealthProbe(async()=>{calls++;await stalled},20);
 const results=await Promise.allSettled([probe(),probe()]);assert.equal(calls,1);
 for(const result of results){assert.equal(result.status,'rejected');if(result.status==='rejected')assert.equal(result.reason.code,'HEALTH_TIMEOUT')}
 await assert.rejects(probe(),{code:'HEALTH_TIMEOUT'});assert.equal(calls,1);
 release();await new Promise(resolve=>setImmediate(resolve));await probe();assert.equal(calls,2);
});
test('API health includes connection time and recovers after its outstanding read settles',async()=>{
 const {buildApp}=await import('../app.js');const {db}=await import('../db.js');
 let release!:()=>void,queries=0;
 const pending=new Promise<void>(resolve=>{release=resolve});
 const fake={$connect:()=>pending,$queryRaw:async()=>{queries++},$disconnect:async()=>{}};
 const app=await buildApp({database:fake as unknown as typeof db,provider:'postgresql',healthTimeoutMs:25});
 try{
  const response=await app.inject({method:'GET',url:'/health'});assert.equal(response.statusCode,503);assert.equal(queries,0);
  release();await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await app.inject({method:'GET',url:'/health'})).statusCode,200);
 }finally{release();await app.close()}
});
