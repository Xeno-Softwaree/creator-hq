import {config as loadEnvironment} from 'dotenv';
loadEnvironment({path:process.env.MIGRATION_ENV_FILE??'.env.migration',quiet:true});
loadEnvironment({path:'.env',quiet:true});
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {postgresUrl} from './config.js';
import {readSnapshot,digest,type Snapshot} from './snapshot.js';
import {inspectPostgresSecurity} from './preflight.js';
import {transferSnapshot} from './transfer.js';
import {checkConnectionAccess} from './connection.js';
import {assertReviewedMigrationHistory,assertReviewedMigrationFiles} from './migration-history.js';
const args=new Set(process.argv.slice(2));
async function main(){
 if(args.has('--check-connection')&&['--apply-schema','--apply-data','--probe-write'].some(flag=>args.has(flag)))throw new Error('READ_ONLY_CONNECTION_MODE_REQUIRED');
 const directory=resolve(process.env.MIGRATION_REPORT_DIR??'../../.local/phase12');mkdirSync(directory,{recursive:true});
 if(args.has('--inspect-source')){const source=readSnapshot(process.env.SQLITE_SOURCE_PATH??'prisma/creator.db');writeFileSync(join(directory,'source-inspection.json'),JSON.stringify(source,null,2),{mode:0o600});console.log(JSON.stringify({sourceCounts:source.counts,fingerprint:source.fingerprint}));return}
 const runtime=postgresUrl(process.env.DATABASE_URL,process.env,'runtime');const migration=postgresUrl(process.env.DIRECT_URL,process.env,'migration');if(runtime.projectIdentity!==migration.projectIdentity)throw new Error('DATABASE_PROJECT_MISMATCH');
 const {PrismaClient,prismaTarget}=await import('./target.js');
 if(args.has('--apply-schema')){
  if(process.env.MIGRATION_SCHEMA_APPROVED!=='true')throw new Error('SCHEMA_APPROVAL_REQUIRED');
  assertReviewedMigrationFiles('prisma/postgresql/migrations');
  const inspection=new PrismaClient({datasources:{db:{url:migration.url}},log:[],errorFormat:'minimal'});
  try{
   const objects=await inspection.$queryRawUnsafe<{tablename:string}[]>("SELECT tablename FROM pg_tables WHERE schemaname='creator_hq'");
   if(objects.length&&!objects.some(row=>row.tablename==='_prisma_migrations'))throw new Error('EXISTING_SCHEMA_REVIEW_REQUIRED');
   if(objects.some(row=>row.tablename==='_prisma_migrations')){
    const history=await inspection.$queryRawUnsafe<{migration_name:string;checksum:string;finished_at:Date|null;rolled_back_at:Date|null}[]>('SELECT migration_name,checksum,finished_at,rolled_back_at FROM creator_hq._prisma_migrations');
    assertReviewedMigrationHistory(history);
   }
  }finally{await inspection.$disconnect()}
  // Prisma deploy uses the schema's directUrl. It never invokes reset or db push.
  try{execFileSync(process.execPath,[resolve('../../node_modules/prisma/build/index.js'),'migrate','deploy','--schema','prisma/postgresql/schema.prisma'],{env:process.env,stdio:'pipe'})}catch{throw new Error('POSTGRES_MIGRATION_DEPLOY_FAILED')}
  console.log('Sürüm kontrollü PostgreSQL şeması uygulandı. Veri aktarımı veya geçiş yapılmadı.');return;
 }
 const admin=new PrismaClient({datasources:{db:{url:migration.url}},log:[],errorFormat:'minimal'});
 const client=new PrismaClient({datasources:{db:{url:runtime.url}},log:[],errorFormat:'minimal'});
 try{
  if(args.has('--check-connection')){console.log(JSON.stringify(await checkConnectionAccess(prismaTarget(client),prismaTarget(admin))));return}
  await client.$queryRaw`SELECT 1`;const security=await inspectPostgresSecurity(prismaTarget(admin));
  await checkConnectionAccess(prismaTarget(client),prismaTarget(admin));
  let writeProbeVerified=false;
  const apply=args.has('--apply-data');
  if(apply||args.has('--probe-write')){
   if(process.env.MIGRATION_PROBE_APPROVED!=='true')throw new Error('ROLLBACK_WRITE_PROBE_APPROVAL_REQUIRED');
   const id='migration-probe-'+randomUUID();
   try{await client.$transaction(async tx=>{await tx.applicationSetting.create({data:{id,value:{probe:true}}});await tx.applicationSetting.update({where:{id},data:{value:{probe:'updated'}}});await tx.applicationSetting.delete({where:{id}});throw new Error('ROLLBACK_PROBE_SUCCESS')})}catch(error){if(!(error instanceof Error)||error.message!=='ROLLBACK_PROBE_SUCCESS')throw new Error('RUNTIME_WRITE_PROBE_FAILED')}
   writeProbeVerified=await client.applicationSetting.count({where:{id}})===0;if(!writeProbeVerified)throw new Error('RUNTIME_PROBE_NOT_ROLLED_BACK');
  }
  if(args.has('--preflight')){console.log(JSON.stringify({connection:'verified',security,writeProbeVerified}));return}

  const manifestPath=process.env.SQLITE_BACKUP_MANIFEST;if(!manifestPath||!existsSync(manifestPath))throw new Error('VERIFIED_SQLITE_BACKUP_REQUIRED');
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8')) as Snapshot&{backupPath:string;sourcePath:string};const backup=readSnapshot(manifest.backupPath);if(backup.fingerprint!==manifest.fingerprint)throw new Error('BACKUP_MANIFEST_MISMATCH');
  const current=readSnapshot(manifest.sourcePath);if(current.fingerprint!==backup.fingerprint)throw new Error('SQLITE_SOURCE_CHANGED_REBACKUP_REQUIRED');
  if(apply&&(process.env.MIGRATION_DATA_APPROVED!=='true'||process.env.MIGRATION_SOURCE_FROZEN!=='true'))throw new Error('DATA_APPROVAL_AND_SOURCE_FREEZE_REQUIRED');
  const report=await transferSnapshot(backup,prismaTarget(client),apply);
  if(readSnapshot(manifest.sourcePath).fingerprint!==backup.fingerprint)throw new Error('SOURCE_CHANGED_CUTOVER_BLOCKED');
  const result={...report,sourcePath:manifest.sourcePath,runtimeVerified:report.verified&&writeProbeVerified,writeProbeVerified,projectIdentity:runtime.projectIdentity,security,createdAt:new Date().toISOString(),migrationId:'20261106000100_phase12_initial'};
  const path=join(directory,'migration-verification-'+Date.now()+'.json');writeFileSync(path,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
  console.log('Kaynak ve hedef kayıt sayıları karşılaştırıldı. Canlı uygulama yapılandırması değiştirilmedi.');console.log(JSON.stringify({verified:result.verified,sourceCounts:result.sourceCounts,destinationCounts:result.destinationCounts,reportPath:path}));
 }finally{await Promise.all([client.$disconnect(),admin.$disconnect()])}
}
main().catch(error=>{const code=error instanceof Error&&/^[A-Z0-9_]+$/.test(error.message)?error.message:'DATABASE_MIGRATION_FAILED';console.error(code+': İşlem güvenli biçimde durduruldu. Gizli bağlantı bilgileri yazdırılmadı; mevcut verilerin üzerine yazılmadı.');process.exitCode=1});
