// Set before importing the app: dotenv must never select production configuration in tests.
export function isolateApiTestEnvironment(url:string,environment:NodeJS.ProcessEnv=process.env){
 if(!url.startsWith('file:'))throw new Error('ISOLATED_SQLITE_FIXTURE_REQUIRED');
 for(const key of Object.keys(environment))if(key==='DIRECT_URL'||key==='SUPABASE_PROJECT_REF'||key==='CREATOR_CODEX_RUNTIME_FILE'||key==='CREATOR_OWNER_PASSWORD_HASH'||key==='DATABASE_VERIFICATION_FILE'||key.startsWith('MIGRATION_')||key.startsWith('PG'))delete environment[key];
 Object.assign(environment,{NODE_ENV:'test',DATABASE_PROVIDER:'sqlite',DATABASE_URL:url,DATABASE_READ_ONLY:'false',DATABASE_CUTOVER_APPROVED:'false',DATABASE_VERIFICATION_FILE:''});
}
