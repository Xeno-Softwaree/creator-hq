import {parse} from 'dotenv';
import {postgresUrl} from './config.js';
import {readSync,fstatSync,writeSync,ftruncateSync,fsyncSync} from 'node:fs';

const gates=['MIGRATION_SCHEMA_APPROVED','MIGRATION_DATA_APPROVED','MIGRATION_PROBE_APPROVED','MIGRATION_SOURCE_FROZEN'];
export function validateConfiguration(text:string){
 const env=parse(text);
 for(const key of ['DATABASE_URL','DIRECT_URL','SUPABASE_PROJECT_REF',...gates]){
  const count=[...text.matchAll(new RegExp('^[ \\t\uFEFF]*(?:export[ \\t]+)?'+key+'[ \\t]*=','gm'))].length;
  if(count!==1)throw new Error('CONFIGURATION_ASSIGNMENT_REVIEW_REQUIRED');
 }
 if(gates.some(key=>env[key]!=='false')||Object.keys(env).some(key=>/^MIGRATION_.*(?:APPROVED|FROZEN)$/.test(key)&&env[key]!=='false')||(env.DATABASE_CUTOVER_APPROVED!==undefined&&env.DATABASE_CUTOVER_APPROVED!=='false'))throw new Error('APPROVAL_GATES_MUST_REMAIN_FALSE');
 const runtime=postgresUrl(env.DATABASE_URL,env,'runtime');
 const administrative=postgresUrl(env.DIRECT_URL,env,'migration');
 const first=new URL(runtime.url),second=new URL(administrative.url);
 if(first.port!=='5432'||second.port!=='5432'||first.hostname!==second.hostname||!first.hostname.endsWith('.pooler.supabase.com')||decodeURIComponent(second.username)!=='postgres.'+env.SUPABASE_PROJECT_REF)throw new Error('SESSION_POOLER_CONFIGURATION_REQUIRED');
 for(const url of [first,second]){
  if(url.hash||!(url.searchParams.get('sslcert')??url.searchParams.get('sslrootcert'))||[...url.searchParams.keys()].some(key=>url.searchParams.getAll(key).length!==1))throw new Error('TLS_CONFIGURATION_REVIEW_REQUIRED');
 }
 return env;
}

// Never serialize the entire URL: doing so would normalize unrelated bytes.
export function replaceRuntimePassword(original:Buffer,rawPassword:string):Buffer{
 if(!rawPassword||rawPassword.length>4096||/[\u0000-\u001f\u007f]/.test(rawPassword))throw new Error('PASSWORD_INPUT_REJECTED');
 const text=original.toString('utf8');
 if(!Buffer.from(text,'utf8').equals(original))throw new Error('UTF8_CONFIGURATION_REQUIRED');
 const env=validateConfiguration(text);
 const assignment=/^[ \t\uFEFF]*(?:export[ \t]+)?DATABASE_URL[ \t]*=[ \t]*/gm.exec(text);
 if(!assignment)throw new Error('DATABASE_URL_ASSIGNMENT_REQUIRED');
 const start=assignment.index+assignment[0].length;
 let end=text.indexOf('\n',start);if(end<0)end=text.length;
 const line=text.slice(start,end).replace(/\r$/,'');
 let value:string,valueStart:number,quote='';
 if(line.startsWith('"')||line.startsWith("'")){
  quote=line[0];const candidates=Array.from(line.matchAll(new RegExp(quote,'g'))).map(match=>match.index!).filter(index=>index>0&&/^[ \t]*(?:#.*)?$/.test(line.slice(index+1))&&line.slice(1,index)===env.DATABASE_URL);
  if(candidates.length!==1)throw new Error('SINGLE_LINE_URL_REQUIRED');const closing=candidates[0];
  value=line.slice(1,closing);valueStart=start+1;
 }else{
  const match=/^(\S+?)([ \t]*(?:#.*)?)$/.exec(line);
  if(!match)throw new Error('SINGLE_LINE_URL_REQUIRED');
  value=match[1];valueStart=start;
 }
 if(value!==env.DATABASE_URL)throw new Error('AMBIGUOUS_DOTENV_VALUE');
 const scheme=/^postgres(?:ql)?:\/\//.exec(value);
 if(!scheme)throw new Error('POSTGRESQL_URL_REQUIRED');
 const authorityStart=scheme[0].length;
 const boundary=value.slice(authorityStart).search(/[/?#]/);
 if(boundary<0)throw new Error('DATABASE_URL_BOUNDARY_REQUIRED');
 const authorityEnd=authorityStart+boundary;
 const separator=value.lastIndexOf('@',authorityEnd);
 const colon=value.indexOf(':',authorityStart);
 if(separator<colon||colon<authorityStart)throw new Error('DATABASE_URL_BOUNDARY_REQUIRED');
 let encoded:string;try{encoded=encodeURIComponent(rawPassword)}catch{throw new Error('PASSWORD_INPUT_REJECTED')}
 // encodeURIComponent intentionally preserves apostrophes. A single-quoted
 // dotenv value cannot be changed safely if that introduces its delimiter.
 if(quote&&encoded.includes(quote))throw new Error('QUOTE_DELIMITER_REVIEW_REQUIRED');
 const from=Buffer.byteLength(text.slice(0,valueStart+colon+1),'utf8');
 const to=Buffer.byteLength(text.slice(0,valueStart+separator),'utf8');
 const updated=Buffer.concat([original.subarray(0,from),Buffer.from(encoded,'utf8'),original.subarray(to)]);
 const updatedEnv=validateConfiguration(updated.toString('utf8'));
 if(decodeURIComponent(new URL(updatedEnv.DATABASE_URL).password)!==rawPassword)throw new Error('PASSWORD_ROUNDTRIP_FAILED');
 for(const key of new Set([...Object.keys(env),...Object.keys(updatedEnv)]))if(key!=='DATABASE_URL'&&env[key]!==updatedEnv[key])throw new Error('UNRELATED_CONFIGURATION_CHANGE_REJECTED');
 return updated;
}

function writeAll(fd:number,bytes:Buffer,writer:typeof writeSync){
 let offset=0;
 while(offset<bytes.length){const written=writer(fd,bytes,offset,bytes.length-offset,offset);if(written<=0)throw new Error('INCOMPLETE_WRITE');offset+=written;}
 ftruncateSync(fd,bytes.length);fsyncSync(fd);
}

export function readDescriptor(fd:number):Buffer{
 const size=fstatSync(fd).size;if(size>1024*1024)throw new Error('CONFIGURATION_TOO_LARGE');
 const bytes=Buffer.alloc(size);let offset=0;
 while(offset<size){const read=readSync(fd,bytes,offset,size-offset,offset);if(read<=0)throw new Error('CONFIGURATION_READ_FAILED');offset+=read;}
 return bytes;
}

// Keep the original file/inode/NTFS ACL; no temporary credential copies.
// An I/O failure triggers best-effort restoration from memory. Power loss or
// unrecoverable storage failure cannot be made atomic by an in-place write.
export function commitPasswordUpdate(fd:number,original:Buffer,updated:Buffer,writer:typeof writeSync=writeSync){
 if(!readDescriptor(fd).equals(original))throw new Error('CONFIGURATION_CHANGED_DURING_PROMPT');
 const info=fstatSync(fd);if(!info.isFile()||info.nlink!==1)throw new Error('REGULAR_PRIVATE_FILE_REQUIRED');
 try{
  writeAll(fd,updated,writer);
  if(!readDescriptor(fd).equals(updated))throw new Error('WRITE_VERIFICATION_FAILED');
 }catch{
  try{writeAll(fd,original,writeSync);if(!readDescriptor(fd).equals(original))throw new Error();}
  catch{throw new Error('WRITE_FAILED_MANUAL_RECOVERY_REQUIRED')}
  throw new Error('WRITE_FAILED_ORIGINAL_RESTORED');
 }
}
