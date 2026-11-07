import {config as loadEnvironment} from 'dotenv';
loadEnvironment({path:process.env.MIGRATION_ENV_FILE??'.env.migration',quiet:true});
loadEnvironment({path:'.env',quiet:true});
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,renameSync,readdirSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {postgresUrl} from './config.js';
function toolVersions(){for(const tool of [process.env.PG_DUMP_BIN??'pg_dump',process.env.PG_RESTORE_BIN??'pg_restore'])execFileSync(tool,['--version'],{stdio:'pipe'});}
try{
 toolVersions();
 if(process.argv.includes('--check-tools'))console.log('PostgreSQL yedekleme araçları kullanılabilir.');
 else {
  if(!process.env.BACKUP_DIR)throw new Error('BACKUP_DIR_REQUIRED');
  const directory=resolve(process.env.BACKUP_DIR);mkdirSync(directory,{recursive:true});
  const days=Number(process.env.BACKUP_RETENTION_DAYS??30);if(!Number.isInteger(days)||days<1||days>3650)throw new Error('INVALID_RETENTION_DAYS');
  if(process.argv.includes('--list-expired')){
   const files=readdirSync(directory).filter(name=>/^creator-hq-postgres-.*\.dump$/.test(name)&&Date.now()-statSync(join(directory,name)).mtimeMs>days*86400000);console.log(JSON.stringify({retentionDays:days,expiredFiles:files,automaticDeletion:false}));
  }else{
   const config=postgresUrl(process.env.DIRECT_URL,process.env,'migration');const url=new URL(config.url);
   const name='creator-hq-postgres-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8)+'.dump';const final=join(directory,name),partial=final+'.partial';
   const cert=url.searchParams.get('sslrootcert')??url.searchParams.get('sslcert');
   const environment={...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:'postgres',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'verify-full',PGCONNECT_TIMEOUT:'15',...(cert?{PGSSLROOTCERT:resolve('prisma/postgresql',cert)}:{})};
   // Credentials are passed through the child environment, never command-line arguments.
   writeFileSync(partial,'',{flag:'wx',mode:0o600});
   execFileSync(process.env.PG_DUMP_BIN??'pg_dump',['--format=custom','--no-owner','--no-privileges','--schema=creator_hq','--file',partial],{env:environment,stdio:'pipe'});
   if(readFileSync(partial).subarray(0,5).toString()!=='PGDMP')throw new Error('INVALID_POSTGRES_ARCHIVE');
   execFileSync(process.env.PG_RESTORE_BIN??'pg_restore',['--list',partial],{stdio:'pipe'});renameSync(partial,final);
   writeFileSync(final+'.json',JSON.stringify({createdAt:new Date().toISOString(),projectIdentity:config.projectIdentity,archiveReadable:true,restoreTested:false,retentionDays:days,scope:'creator_hq',rolesIncluded:false},null,2),{flag:'wx',mode:0o600});
   console.log(JSON.stringify({backupPath:final,archiveReadable:true,restoreTested:false,automaticDeletion:false}));
  }
 }
}catch(error){const code=error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'POSTGRES_BACKUP_TOOLS_OR_BACKUP_FAILED';console.error(code+': PostgreSQL yedeği doğrulanamadı. pg_dump/pg_restore kurulumu ve sunucu ayarlarını kontrol edin. Gizli bilgiler yazdırılmadı.');process.exitCode=1}
