import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateDeploymentEnvironment} from './deployment-policy.mjs';
test('public builds reject private paths and credential-bearing URLs without echoing values',()=>{
 const machine=['C:',String.fromCharCode(92),'Users',String.fromCharCode(92),'owner'].join('');
 for(const value of [machine,['/home','/owner','/private'].join(''),'//host/share','file:./private']){
  const result=validateDeploymentEnvironment({NEXT_PUBLIC_DEPLOYMENT_MODE:'public',NEXT_PUBLIC_STORAGE_VAULT_PATH:value});assert.equal(result[0].code,'PUBLIC_STORAGE_PATH_MUST_BE_RELATIVE');assert.ok(!JSON.stringify(result).includes(value));
 }
 const result=validateDeploymentEnvironment({NEXT_PUBLIC_DEPLOYMENT_MODE:'public',NEXT_PUBLIC_API_URL:'http://user:password@localhost:4100'});assert.equal(result[0].code,'PUBLIC_URL_MUST_NOT_CONTAIN_CREDENTIALS');
});
test('personal settings remain unchanged and safe public relative configuration passes',()=>{
 assert.deepEqual(validateDeploymentEnvironment({NEXT_PUBLIC_DEPLOYMENT_MODE:'personal',NEXT_PUBLIC_STORAGE_VAULT_PATH:'/private/personal'}),[]);
 assert.deepEqual(validateDeploymentEnvironment({NEXT_PUBLIC_DEPLOYMENT_MODE:'public',NEXT_PUBLIC_STORAGE_VAULT_PATH:'./private/vaults',NEXT_PUBLIC_API_URL:'http://127.0.0.1:4100'}),[]);
});

test('database and privileged credentials are never allowed in public client variables',()=>{
 for(const key of ['NEXT_PUBLIC_DATABASE_URL','NEXT_PUBLIC_DIRECT_URL','NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY']){const result=validateDeploymentEnvironment({[key]:'placeholder'});assert.equal(result[0].code,'DATABASE_SECRET_MUST_REMAIN_SERVER_SIDE')}
});
