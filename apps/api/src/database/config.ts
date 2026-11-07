import {createHash} from 'node:crypto';
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type Environment=Record<string,string|undefined>;
export function postgresUrl(value:string|undefined,environment:Environment,kind:'runtime'|'migration'){
 if(!value)throw new Error(kind==='runtime'?'DATABASE_URL_REQUIRED':'DIRECT_URL_REQUIRED');
 let url:URL;try{url=new URL(value)}catch{throw new Error('INVALID_DATABASE_URL')}
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('POSTGRESQL_URL_REQUIRED');
 const reference=environment.SUPABASE_PROJECT_REF;if(!reference||!/^[a-z0-9]{10,40}$/.test(reference))throw new Error('SUPABASE_PROJECT_REF_REQUIRED');
 const direct=url.hostname===`db.${reference}.supabase.co`;
 const pooler=url.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(url.username).endsWith('.'+reference);
 if(!direct&&!pooler)throw new Error('DATABASE_PROJECT_MISMATCH');
 if(url.pathname!=='/postgres'||url.searchParams.get('schema')!=='creator_hq')throw new Error('PRIVATE_DATABASE_SCHEMA_REQUIRED');
 if(!url.username||!url.password)throw new Error('DATABASE_CREDENTIALS_REQUIRED');
 if(url.searchParams.get('sslmode')!=='require'||url.searchParams.get('sslaccept')!=='strict')throw new Error('STRICT_DATABASE_TLS_REQUIRED');
 if(url.searchParams.has('host')||url.searchParams.has('options'))throw new Error('UNREVIEWED_DATABASE_URL_OPTIONS');
 const port=url.port||'5432';
 if(kind==='migration'&&(port!=='5432'||url.searchParams.get('pgbouncer')==='true'))throw new Error('MIGRATION_SESSION_CONNECTION_REQUIRED');
 if(!['5432','6543'].includes(port))throw new Error('UNSUPPORTED_DATABASE_PORT');
 if(port==='6543'&&url.searchParams.get('pgbouncer')!=='true')throw new Error('TRANSACTION_POOLER_FLAG_REQUIRED');
 if(kind==='runtime'&&decodeURIComponent(url.username)!==(pooler?'creator_hq_runtime.'+reference:'creator_hq_runtime'))throw new Error('LEAST_PRIVILEGE_RUNTIME_ROLE_REQUIRED');
 for(const [name,max] of [['connect_timeout',15],['pool_timeout',15],['connection_limit',5],['socket_timeout',30]] as const){const number=Number(url.searchParams.get(name));if(!Number.isInteger(number)||number<1||number>max)throw new Error('BOUNDED_DATABASE_CONNECTION_REQUIRED')}
 return {url:url.toString(),projectIdentity:digest({reference,database:'postgres',schema:'creator_hq'})};
}
export function databaseConfiguration(environment:Environment){
 const provider=environment.DATABASE_PROVIDER;
 if(!provider)throw new Error('DATABASE_PROVIDER_REQUIRED');
 if(provider==='sqlite'){const url=environment.DATABASE_URL??'file:./creator.db';if(!url.startsWith('file:'))throw new Error('SQLITE_URL_REQUIRED');return {provider:'sqlite' as const,url}}
 if(provider!=='postgresql')throw new Error('INVALID_DATABASE_PROVIDER');
 const configuration=postgresUrl(environment.DATABASE_URL,environment,'runtime');
 // Operator opt-in remains mandatory. Historical receipts and SQLite copies are
 // retained as migration evidence, never as a runtime filesystem dependency.
 if(environment.DATABASE_CUTOVER_APPROVED!=='true')throw new Error('VERIFIED_CUTOVER_APPROVAL_REQUIRED');
 if(environment.DIRECT_URL)throw new Error('ADMINISTRATIVE_URL_NOT_ALLOWED_IN_RUNTIME');
 return {provider:'postgresql' as const,...configuration};
}
