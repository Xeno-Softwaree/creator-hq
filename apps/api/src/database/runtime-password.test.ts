import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync,writeFileSync,readFileSync,openSync,closeSync,rmSync,statSync,readdirSync,writeSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {parse} from 'dotenv';
import {replaceRuntimePassword,commitPasswordUpdate,readDescriptor} from './runtime-password.js';
import {readHiddenPassword,type SecretInput} from './hidden-password.js';

// Fake credentials only; no project configuration is read by these tests.
function fixture(quote='"',eol='\r\n'){
 const reference='abcdefghijklmnopqrst';const endpoint='aws-0-fixture.pooler.supabase.com:5432/postgres';
 const params='?schema=creator_hq&sslmode=require&sslaccept=strict&connect_timeout=10&pool_timeout=10&socket_timeout=20&connection_limit=5&sslrootcert=fixture-ca.crt';
 const runtime='postgresql:'+'//'+'creator_hq_runtime.'+reference+':old@unencoded@'+endpoint+params;
 const administrative='postgresql:'+'//'+'postgres.'+reference+':'+encodeURIComponent('admin%40-fixture')+'@'+endpoint+params;
 return {runtime,bytes:Buffer.from('\ufeff# Preserved Unicode: çğış🔐'+eol+'  export DATABASE_URL = '+quote+runtime+quote+' # preserved "comment"'+eol+'DIRECT_URL='+administrative+eol+'SUPABASE_PROJECT_REF='+reference+eol+'SQLITE_BACKUP_MANIFEST=./preserved-manifest.json'+eol+'BACKUP_DIR=./preserved-backups'+eol+['MIGRATION_SCHEMA_APPROVED','MIGRATION_DATA_APPROVED','MIGRATION_PROBE_APPROVED','MIGRATION_SOURCE_FROZEN'].map(key=>key+'=false').join(eol)+eol)};
}

test('only the runtime password span changes; BOM, CRLF, quotes, comments and all other bytes survive',()=>{
 for(const quote of ['"',"'",'']){
  const source=fixture(quote);const raw='fake@:#?%40/\\$&+ ç🔐';
  const changed=replaceRuntimePassword(source.bytes,raw);
  const updatedValue=source.runtime.replace(':old@unencoded@',':'+encodeURIComponent(raw)+'@');
  assert.equal(changed.toString('utf8'),source.bytes.toString('utf8').replace(source.runtime,updatedValue));
  assert.equal(decodeURIComponent(new URL(parse(changed).DATABASE_URL).password),raw);
  assert.equal(parse(changed).DIRECT_URL,parse(source.bytes).DIRECT_URL);
 }
});

test('raw percent sequences are encoded once, not decoded or normalized first',()=>{
 const source=fixture();const changed=replaceRuntimePassword(source.bytes,'literal%40@%');
 const password=new URL(parse(changed).DATABASE_URL).password;
 assert.equal(password,encodeURIComponent('literal%40@%'));
 assert.ok(password.includes('%2540'));
});
test('first-line BOM and LF file without a trailing newline are preserved',()=>{
 const source=fixture('"','\n');const text=source.bytes.toString().replace(/^\ufeff#[^\n]*\n/,'\ufeff').replace(/\n$/,'');
 const changed=replaceRuntimePassword(Buffer.from(text),'fake-new@value').toString();
 assert.equal(changed,text.replace(':old@unencoded@',':'+encodeURIComponent('fake-new@value')+'@'));
});

test('ambiguous assignments, live gates, unsupported quoting and invalid input fail closed',()=>{
 const source=fixture();
 assert.throws(()=>replaceRuntimePassword(Buffer.concat([source.bytes,Buffer.from('DATABASE_URL=duplicate\n')]),'fake'),/ASSIGNMENT_REVIEW/);
 assert.throws(()=>replaceRuntimePassword(Buffer.from(source.bytes.toString().replace('MIGRATION_DATA_APPROVED=false','MIGRATION_DATA_APPROVED=true')),'fake'),/GATES_MUST/);
 assert.throws(()=>replaceRuntimePassword(fixture("'").bytes,"contains'apostrophe"),/QUOTE_DELIMITER/);
 for(const raw of ['', 'bad\ninput','bad\u0000input','\ud800'])assert.throws(()=>replaceRuntimePassword(source.bytes,raw),/PASSWORD_INPUT_REJECTED/);
});

function temporaryFile(){
 const directory=mkdtempSync(join(tmpdir(),'creator-hq-password-fixture-'));const file=join(directory,'fixture.env');const source=fixture();
 writeFileSync(file,source.bytes,{mode:0o600});const fd=openSync(file,'r+');
 return {file,directory,fd,original:source.bytes,cleanup:()=>{closeSync(fd);assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));rmSync(directory,{recursive:true,force:true})}};
}
test('commit preserves file identity and makes no credential-copy files',()=>{
 const context=temporaryFile();try{
  const before=statSync(context.file);const changed=replaceRuntimePassword(context.original,'fake-new@value');
  commitPasswordUpdate(context.fd,context.original,changed);
  assert.deepEqual(readDescriptor(context.fd),changed);assert.deepEqual(readDescriptor(context.fd),changed);
  assert.equal(statSync(context.file).ino,before.ino);assert.equal(statSync(context.file).mode,before.mode);
  assert.deepEqual(readdirSync(context.directory),['fixture.env']);
 }finally{context.cleanup()}
});
test('concurrent edits are preserved; partial write failure restores the original bytes without leaking the cause',()=>{
 const context=temporaryFile();try{
  const changed=replaceRuntimePassword(context.original,'fake-new-value');
  writeFileSync(context.file,'concurrent fixture');
  assert.throws(()=>commitPasswordUpdate(context.fd,context.original,changed),/CHANGED_DURING_PROMPT/);
  assert.equal(readFileSync(context.file,'utf8'),'concurrent fixture');
  writeFileSync(context.file,context.original);let first=true;
  const failingWriter=((fd:number,data:Buffer,offset:number,length:number,position:number)=>{
   if(first){first=false;return writeSync(fd,data,offset,Math.min(length,12),position)}throw new Error('fixture-sensitive-cause');
  }) as typeof writeSync;
  assert.throws(()=>commitPasswordUpdate(context.fd,context.original,changed,failingWriter),/^Error: WRITE_FAILED_ORIGINAL_RESTORED$/);
  assert.deepEqual(readFileSync(context.file),context.original);
 }finally{context.cleanup()}
});

class Terminal extends EventEmitter implements SecretInput{
 isTTY=true;isRaw=false;readableEncoding=null;paused=true;chunks:Buffer[]=[];
 setRawMode(mode:boolean){this.isRaw=mode}
 isPaused(){return this.paused}
 pause(){this.paused=true}
 resume(){this.paused=false;for(const chunk of this.chunks)queueMicrotask(()=>this.emit('data',chunk))}
}
test('hidden input never echoes secrets and restores raw mode after Unicode/backspace input',async()=>{
 const input=new Terminal();input.chunks=[Buffer.from('fake🔐\u007f'),Buffer.from('@value\r')];let output='';
 const secret=await readHiddenPassword(input,{isTTY:true,write:text=>{output+=text}},'Prompt: ');
 assert.equal(secret,'fake@value');assert.equal(output,'Prompt: \n');assert.equal(input.isRaw,false);assert.equal(input.paused,true);assert.equal(input.listenerCount('data'),0);
});
test('non-TTY or failed raw mode stops before displaying a password prompt',()=>{
 const input=new Terminal();input.isTTY=false;let output='';
 assert.throws(()=>readHiddenPassword(input,{isTTY:true,write:text=>{output+=text}},'Prompt'),/SECURE_TERMINAL_REQUIRED/);
 input.isTTY=true;input.setRawMode=()=>{throw new Error('fixture-cause')};
 assert.throws(()=>readHiddenPassword(input,{isTTY:true,write:text=>{output+=text}},'Prompt'),/SECURE_TERMINAL_REQUIRED/);
 assert.equal(output,'');
});
test('cancellation, unsafe paste and timeout restore terminal state without displaying input',async()=>{
 for(const chunks of [[Buffer.from('fake\u0003')],[Buffer.from('fake\rtrailing')],[Buffer.from('\u001b[200~paste')],[]]){
  const input=new Terminal();input.chunks=chunks;let output='';
  await assert.rejects(readHiddenPassword(input,{isTTY:true,write:text=>{output+=text}},'Prompt: ',20),/SECRET_INPUT_(CANCELLED|REJECTED|TIMEOUT)/);
  assert.equal(output,'Prompt: \n');assert.equal(input.isRaw,false);assert.equal(input.listenerCount('data'),0);
 }
});

test('Prisma sslcert CA parameter preserves password-only editing and strict TLS',()=>{
 const original=Buffer.from(fixture().bytes.toString().replaceAll('sslrootcert=','sslcert='));
 const changed=replaceRuntimePassword(original,'fixture-new@password');
 const env=parse(changed);
 for(const key of ['DATABASE_URL','DIRECT_URL']){
  const url=new URL(env[key]);
  assert.equal(url.searchParams.get('sslcert'),'fixture-ca.crt');
  assert.equal(url.searchParams.get('sslaccept'),'strict');
  assert.equal(url.searchParams.get('sslmode'),'require');
 }
 assert.equal(env.DIRECT_URL,parse(original).DIRECT_URL);
});
