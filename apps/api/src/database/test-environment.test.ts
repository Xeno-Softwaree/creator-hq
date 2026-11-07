import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isolateApiTestEnvironment} from './test-environment.js';
test('API fixtures override inherited production settings before dotenv can load them',()=>{
 const env:NodeJS.ProcessEnv={DATABASE_PROVIDER:'postgresql',DATABASE_URL:'private-value',DIRECT_URL:'private-admin',DATABASE_CUTOVER_APPROVED:'true',DATABASE_READ_ONLY:'true',DATABASE_VERIFICATION_FILE:'private-receipt',MIGRATION_DATA_APPROVED:'true',PGPASSWORD:'private-password'};
 isolateApiTestEnvironment('file:./isolated-test.db',env);
 assert.equal(env.DATABASE_PROVIDER,'sqlite');assert.equal(env.DATABASE_URL,'file:./isolated-test.db');assert.equal(env.DATABASE_CUTOVER_APPROVED,'false');assert.equal(env.DATABASE_READ_ONLY,'false');assert.equal(env.DATABASE_VERIFICATION_FILE,'');
 for(const key of ['DIRECT_URL','MIGRATION_DATA_APPROVED','PGPASSWORD'])assert.equal(env[key],undefined);
 assert.throws(()=>isolateApiTestEnvironment('private-production-value',{}),/ISOLATED_SQLITE_FIXTURE_REQUIRED/);
});
