import {fields,tableNames,normalize,makeSnapshot,digest,timestampFields,type Snapshot,type TableName,type Row} from './snapshot.js';
export interface SqlTarget {
 query(sql:string,parameters?:unknown[]):Promise<Record<string,unknown>[]>;
 transaction<T>(operation:(target:SqlTarget)=>Promise<T>):Promise<T>;
}
const columns=(table:TableName)=>fields[table].map(field=>`"${field}"`).join(',');
// Identifiers and casts come only from the fixed schema allowlist; values remain bound.
const placeholders=(table:TableName)=>fields[table].map((field,index)=>{
 const type=timestampFields.has(field)?'timestamptz':['enabled','simulated'].includes(field)?'boolean':'text';
 return `$${index+1}::${type}`;
}).join(',');
export async function destinationSnapshot(target:SqlTarget){
 const tables={} as Record<TableName,Row[]>;
 for(const table of tableNames)tables[table]=(await target.query(`SELECT ${columns(table)} FROM creator_hq."${table}" ORDER BY id`)).map(row=>normalize(table,row));
 return makeSnapshot(tables);
}
function requireCompatible(source:Snapshot,destination:Snapshot){
 for(const table of tableNames){const known=new Map(source.tables[table].map(row=>[row.id,row]));for(const row of destination.tables[table]){const expected=known.get(row.id);if(!expected)throw new Error('TARGET_HAS_UNRELATED_RECORDS');if(digest(row)!==digest(expected))throw new Error('TARGET_ROW_CONFLICT');}}
}
export async function transferSnapshot(source:Snapshot,target:SqlTarget,apply=false){
 const canonical=makeSnapshot(source.tables);if(source.fingerprint!==canonical.fingerprint||JSON.stringify(source.counts)!==JSON.stringify(canonical.counts))throw new Error('SOURCE_MANIFEST_MISMATCH');
 return target.transaction(async transaction=>{
  const before=await destinationSnapshot(transaction);requireCompatible(source,before);
  // No existing value is overwritten. Concurrent inserts either match on verification or abort.
  if(apply)for(const table of tableNames)for(const row of source.tables[table]){
   const parameters=fields[table].map(field=>row[field]);
   await transaction.query(`INSERT INTO creator_hq."${table}" (${columns(table)}) VALUES (${placeholders(table)}) ON CONFLICT (id) DO NOTHING`,parameters);
  }
  const after=await destinationSnapshot(transaction);requireCompatible(source,after);
  const verified=after.fingerprint===source.fingerprint;
  if(apply&&!verified)throw new Error('DESTINATION_VERIFICATION_FAILED');
  return {version:1,applied:apply,verified,canApply:true,sourceCounts:source.counts,destinationCounts:after.counts,sourceFingerprint:source.fingerprint,destinationFingerprint:after.fingerprint,primaryKeysMatch:verified,allFieldsMatch:verified,relationshipsValid:true};
 });
}
