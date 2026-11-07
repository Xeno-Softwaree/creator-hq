import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
// Reviewed byte checksums. Additional migrations require a new review.
export const reviewedMigrations=[
  {
    "name": "20261106000100_phase12_initial",
    "checksum": "8edd3dd1f2b5d9e9f949c3c2abad73a1504a8b79e1539706ccb1f4a942410d2a"
  },
  {
    "name": "20261107000100_phase20_atlas_text",
    "checksum": "5df629368ffe9ff3a49d47333efd115ef67f327d345a62ba18911142c9eefdb4"
  },
  {
    "name": "20261107000200_phase20_atlas_disable",
    "checksum": "bd5c3d54873f0a1d32e649b3fadbd6c26052f44d8f8eddd8a274a5abc05780b8"
  }
] as const;
export function assertReviewedMigrationHistory(rows:readonly {migration_name:string;checksum:string;finished_at:unknown;rolled_back_at:unknown}[]){
 const names=new Set<string>();for(const row of rows){const index=reviewedMigrations.findIndex(m=>m.name===row.migration_name);if(index<0||names.has(row.migration_name)||row.checksum!==reviewedMigrations[index].checksum||!row.finished_at||row.rolled_back_at)throw Error('MIGRATION_HISTORY_REVIEW_REQUIRED');names.add(row.migration_name);}
 for(let i=0;i<reviewedMigrations.length;i++)if(names.has(reviewedMigrations[i].name)&&reviewedMigrations.slice(0,i).some(m=>!names.has(m.name)))throw Error('MIGRATION_HISTORY_REVIEW_REQUIRED');
}
export function assertReviewedMigrationFiles(directory:string){
 const found=new Set<string>();
 for(const entry of readdirSync(directory,{withFileTypes:true})){
  if(entry.isFile()&&entry.name==='migration_lock.toml')continue;
  if(!entry.isDirectory())throw Error('MIGRATION_FILES_REVIEW_REQUIRED');
  const expected=reviewedMigrations.find(m=>m.name===entry.name);if(!expected)throw Error('MIGRATION_FILES_REVIEW_REQUIRED');
  const checksum=createHash('sha256').update(readFileSync(join(directory,entry.name,'migration.sql'))).digest('hex');if(checksum!==expected.checksum)throw Error('MIGRATION_FILES_REVIEW_REQUIRED');found.add(entry.name);
 }
 if(!found.has(reviewedMigrations[0].name)||reviewedMigrations.some((m,i)=>found.has(m.name)&&reviewedMigrations.slice(0,i).some(prior=>!found.has(prior.name))))throw Error('MIGRATION_FILES_REVIEW_REQUIRED');
}
