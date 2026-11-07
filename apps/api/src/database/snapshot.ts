import { DatabaseSync, backup } from 'node:sqlite';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {mkdirSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
export const fields = {
 Agent:['id','name','role','studio','instructions','enabled'],
 Task:['id','title','description','studio','status','agentId','createdAt','updatedAt'],
 Activity:['id','agentId','message','simulated','createdAt'],
 Approval:['id','title','agentId','status','simulated','createdAt'],
 StudioSettings:['id','contentLanguage'],
 AgentReport:['id','sourceId','agentId','taskId','approvalId','source','status','summaryData','originalTechnicalReport','createdAt']
} as const;
export type TableName=keyof typeof fields;
export const tableNames=Object.keys(fields) as TableName[];
export type Row=Record<string,string|boolean|null>;
export type Snapshot={version:1;tables:Record<TableName,Row[]>;counts:Record<TableName,number>;fingerprint:string};
export const timestampFields=new Set(['createdAt','updatedAt']);
// Accept only explicit instants at the destination's millisecond precision.
export function normalizeTimestamp(value:unknown):string {
 if(typeof value==='string'){
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if(!match)throw new Error('INVALID_TIMESTAMP');
  const [,year,month,day,hour,minute,second,fraction,zone]=match;
  if(fraction&&fraction.length>3)throw new Error('TIMESTAMP_PRECISION_UNSUPPORTED');
  const y=Number(year),m=Number(month),d=Number(day);
  const leap=y%4===0&&(y%100!==0||y%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(y<1||m<1||m>12||d<1||d>days[m-1]||Number(hour)>23||Number(minute)>59||Number(second)>59||
   (zone!=='Z'&&(Number(zone.slice(1,3))>23||Number(zone.slice(4))>59)))throw new Error('INVALID_TIMESTAMP');
 }else if(!(value instanceof Date)&&!(typeof value==='number'&&Number.isSafeInteger(value)))throw new Error('INVALID_TIMESTAMP');
 const date=value instanceof Date?value:new Date(value as string|number);
 if(!Number.isFinite(date.getTime())||date.getUTCFullYear()<1||date.getUTCFullYear()>9999)throw new Error('INVALID_TIMESTAMP');
 return date.toISOString();
}
export function normalize(table:TableName,row:Record<string,unknown>):Row {
 if(Object.keys(row).length!==fields[table].length||Object.keys(row).some(key=>!fields[table].includes(key as never)))throw new Error('SOURCE_FIELD_MISMATCH');
 const result:Row={};
 for(const field of fields[table]){
  const value=row[field];
  if(timestampFields.has(field)){result[field]=normalizeTimestamp(value);continue}
  if(value===undefined)throw new Error('SOURCE_FIELD_MISSING');
  if(value===null){if(!['taskId','approvalId'].includes(field))throw new Error('SOURCE_REQUIRED_FIELD_NULL');result[field]=null;continue}
  if(['enabled','simulated'].includes(field)){if(![true,false,0,1].includes(value as boolean))throw new Error('INVALID_BOOLEAN');result[field]=Boolean(value)}
  else {if(typeof value!=='string')throw new Error('INVALID_FIELD_TYPE');result[field]=value}
 }
 return result;
}
export const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function makeSnapshot(tables:Record<TableName,Row[]>):Snapshot {
 for(const table of tableNames)tables[table]=tables[table].map(row=>normalize(table,row));
 for(const table of tableNames)tables[table].sort((a,b)=>String(a.id).localeCompare(String(b.id),'en'));
 validateRelationships(tables);
 return {version:1,tables,counts:Object.fromEntries(tableNames.map(table=>[table,tables[table].length])) as Record<TableName,number>,fingerprint:digest(tables)};
}
export function validateRelationships(tables:Record<TableName,Row[]>){
 const ids=Object.fromEntries(tableNames.map(table=>[table,new Set(tables[table].map(row=>row.id))])) as Record<TableName,Set<unknown>>;
 for(const table of tableNames){if(ids[table].size!==tables[table].length||tables[table].some(row=>typeof row.id!=='string'||!row.id.trim()))throw new Error('INVALID_PRIMARY_KEYS')}
 for(const table of ['Task','Activity','Approval','AgentReport'] as const)for(const row of tables[table])if(!ids.Agent.has(row.agentId))throw new Error('ORPHAN_AGENT_REFERENCE');
 for(const table of ['Agent','Task'] as const)for(const row of tables[table])if(!['HQ','Niko','Son Yedek'].includes(String(row.studio)))throw new Error('UNKNOWN_STUDIO');
 for(const row of tables.StudioSettings)if(!['Niko','Son Yedek'].includes(String(row.id))||!['tr-TR','en-US'].includes(String(row.contentLanguage)))throw new Error('INVALID_STUDIO_SETTINGS');
 for(const row of tables.Task){const agent=tables.Agent.find(agent=>agent.id===row.agentId);if(agent&&agent.studio!=='HQ'&&agent.studio!==row.studio)throw new Error('SOURCE_STUDIO_AGENT_MISMATCH')}
 if(new Set(tables.AgentReport.map(row=>row.sourceId)).size!==tables.AgentReport.length)throw new Error('DUPLICATE_REPORT_SOURCE');
 for(const row of tables.Task)if(!['Backlog','In progress','Review','Done'].includes(String(row.status)))throw new Error('INVALID_TASK_STATUS');
 for(const row of tables.Approval)if(!['Pending','Approved','Rejected'].includes(String(row.status)))throw new Error('INVALID_APPROVAL_STATUS');
 for(const row of tables.AgentReport){if(row.taskId&&!ids.Task.has(row.taskId))throw new Error('ORPHAN_TASK_REFERENCE');if(row.approvalId&&!ids.Approval.has(row.approvalId))throw new Error('ORPHAN_APPROVAL_REFERENCE');if(!['completed','awaiting_approval','blocked','failed','partial'].includes(String(row.status)))throw new Error('INVALID_REPORT_STATUS');}
}
export function readSnapshot(path:string):Snapshot {
 const source=new DatabaseSync(resolve(path),{readOnly:true});
 try{
  if(source.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok')throw new Error('SQLITE_INTEGRITY_FAILED');
  const actual=source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name!='_prisma_migrations'").all().map(row=>String(row.name));
  if(actual.some(name=>!tableNames.includes(name as TableName))||tableNames.some(name=>!actual.includes(name)))throw new Error('UNSUPPORTED_SOURCE_SCHEMA');
  const tables={} as Record<TableName,Row[]>;
  for(const table of tableNames){const columns=source.prepare(`PRAGMA table_info("${table}")`).all().map(row=>String(row.name));if(columns.length!==fields[table].length||fields[table].some(field=>!columns.includes(field)))throw new Error('UNSUPPORTED_SOURCE_COLUMNS');tables[table]=source.prepare(`SELECT * FROM "${table}" ORDER BY id`).all().map(row=>normalize(table,row));}
  return makeSnapshot(tables);
 }finally{source.close()}
}
export async function backupSqlite(sourcePath:string,directory:string){
 const source=resolve(sourcePath),destination=resolve(directory);mkdirSync(destination,{recursive:true});
 const name='creator-hq-sqlite-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+createHash('sha256').update(String(Math.random())).digest('hex').slice(0,8)+'.db';
 const path=join(destination,name);if(existsSync(path)||path===realpathSync(source))throw new Error('BACKUP_TARGET_EXISTS');
 writeFileSync(path,'',{flag:'wx',mode:0o600});
 const database=new DatabaseSync(source,{readOnly:true});
 try{await backup(database,path)}finally{database.close()}
 const snapshot=readSnapshot(path);const manifest={...snapshot,backupPath:path,sourcePath:source,createdAt:new Date().toISOString()};
 writeFileSync(path+'.json',JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
 return {path,manifestPath:path+'.json',snapshot};
}
