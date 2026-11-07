import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,unlinkSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {PrismaClient} from '../../generated/postgresql/index.js';
// Synthetic loopback cluster only; never loads environment files or remote credentials.
export async function isolatedPostgres(){
 const bin=process.env.CREATOR_TEST_POSTGRES_BIN;if(!bin)throw Error('ISOLATED_POSTGRES_TOOLS_REQUIRED');
 const directory=mkdtempSync(join(tmpdir(),'creator-hq-pg20-')),cluster=join(directory,'cluster');let started=false,client:PrismaClient|undefined;
 const run=(name:string,args:string[],options:Record<string,unknown>={})=>{try{return execFileSync(join(bin,name+(process.platform==='win32'?'.exe':'')),args,{stdio:name==='pg_ctl'?'ignore':'pipe',encoding:'utf8',windowsHide:true,timeout:30000,...options})}catch{throw Error('ISOLATED_'+name.toUpperCase()+'_FAILED')}};
 async function close(){await client?.$disconnect();if(started){run('pg_ctl',['-D',cluster,'-m','fast','-w','stop']);started=false}const target=resolve(directory);if(!target.startsWith(resolve(tmpdir())+sep))throw Error('ISOLATED_CLEANUP_BOUNDARY');rmSync(target,{recursive:true,force:true})}
 try{
  if(process.platform==='win32'){const sid=execFileSync('whoami',['/user','/fo','csv','/nh'],{encoding:'utf8'}).match(/S-1-5-[0-9-]+/)?.[0];if(!sid)throw Error('ISOLATED_ACCOUNT_REQUIRED');execFileSync('icacls',[directory,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F'],{stdio:'pipe'})}
  const password=randomBytes(32).toString('hex'),pw=join(directory,'bootstrap-secret');writeFileSync(pw,password,{mode:0o600});try{run('initdb',['-D',cluster,'-U','postgres','--auth-host=scram-sha-256','--auth-local=scram-sha-256','--encoding=UTF8','--locale=C','--pwfile',pw])}finally{unlinkSync(pw)}
  const port=await new Promise<number>((yes,no)=>{const server=createServer();server.on('error',no);server.listen(0,'127.0.0.1',()=>{const port=(server.address() as {port:number}).port;server.close(e=>e?no(e):yes(port))})});if(port===5432)throw Error('ISOLATED_PORT_INVALID');
  try{run('pg_ctl',['-D',cluster,'-l',join(directory,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -c log_statement=none -c log_min_error_statement=panic`,'-w','start'])}finally{started=existsSync(join(cluster,'postmaster.pid'))}
  const env={SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,PGHOST:'127.0.0.1',PGPORT:String(port),PGDATABASE:'postgres',PGUSER:'postgres',PGPASSWORD:password,PGSSLMODE:'disable'},runtimePassword=randomBytes(32).toString('hex');
  run('psql',['-X','-v','ON_ERROR_STOP=1','-f','-'],{env,input:`CREATE ROLE creator_hq_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION PASSWORD '${runtimePassword}'; CREATE SCHEMA creator_hq; CREATE TABLE creator_hq._prisma_migrations(id text);`});
  run('psql',['-X','-v','ON_ERROR_STOP=1','-f',fileURLToPath(new URL('../../prisma/postgresql/migrations/20261106000100_phase12_initial/migration.sql',import.meta.url))],{env});
  const url=new URL(`postgresql://127.0.0.1:${port}/postgres`);url.username='creator_hq_runtime';url.password=runtimePassword;for(const [k,v] of Object.entries({schema:'creator_hq',sslmode:'disable',connection_limit:'5',connect_timeout:'2',pool_timeout:'2',socket_timeout:'5'}))url.searchParams.set(k,v);
  const adminScript=(sql:string)=>run('psql',['-X','-v','ON_ERROR_STOP=1','-f','-'],{env,input:sql});
  client=new PrismaClient({datasources:{db:{url:url.toString()}},log:[],errorFormat:'minimal'});return {client,close,directory,adminScript};
 }catch(error){await close();throw error}
}
