import {execFileSync} from 'node:child_process';
import {openSync,closeSync,lstatSync,fstatSync,statSync} from 'node:fs';
import {dirname,resolve,basename,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {url as inspectorUrl} from 'node:inspector';
import {requireHiddenTerminal,readHiddenPassword} from './hidden-password.js';
import {readDescriptor,replaceRuntimePassword,validateConfiguration,commitPasswordUpdate} from './runtime-password.js';

const apiRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const repository=resolve(apiRoot,'../..');
const file=resolve(apiRoot,'.env.migration');
function verifyIgnored(){
 try{
  execFileSync('git',['check-ignore','--quiet','--','apps/api/.env.migration'],{cwd:repository,stdio:'pipe',timeout:5000});
  const tracked=execFileSync('git',['ls-files','--cached','--','apps/api/.env.migration'],{cwd:repository,stdio:'pipe',encoding:'utf8',timeout:5000});
  if(tracked.trim())throw new Error();
 }catch{throw new Error('PRIVATE_GIT_IGNORE_REQUIRED')}
}
function verifyLocalPaths(text:string){
 const env=validateConfiguration(text);
 const roots=[new URL(env.DATABASE_URL),new URL(env.DIRECT_URL)].map(url=>(url.searchParams.get('sslcert')??url.searchParams.get('sslrootcert'))!);
 for(const certificate of roots){
  if(!/^[A-Za-z]:[\\/]/.test(certificate)||!isAbsolute(certificate)||!statSync(certificate).isFile())throw new Error('LOCAL_CA_FILE_REQUIRED');
 }
 for(const [key,expected] of [['PG_DUMP_BIN','pg_dump.exe'],['PG_RESTORE_BIN','pg_restore.exe']]){
  const value=env[key];
  if(!value||!/^[A-Za-z]:[\\/]/.test(value)||!isAbsolute(value)||basename(value).toLowerCase()!==expected||!statSync(value).isFile())throw new Error('LOCAL_POSTGRES_TOOL_REQUIRED');
 }
}
async function main(){
 if(process.argv.length!==3||process.argv[2]!=='--operator-approved')throw new Error('EXPLICIT_OPERATOR_APPROVAL_REQUIRED');
 if(inspectorUrl()||process.env.NODE_OPTIONS||process.env.NODE_DEBUG||process.env.NODE_DEBUG_NATIVE||process.env.DEBUG||process.execArgv.some(value=>/^--(?:inspect|debug|trace|heap|cpu-prof|prof|report|diagnostic)/.test(value))||/^(?:true|1)$/i.test(process.env.CI??''))throw new Error('SECURE_TERMINAL_REQUIRED');
 requireHiddenTerminal(process.stdin,process.stdout);
 verifyIgnored();
 const entry=lstatSync(file);if(!entry.isFile()||entry.isSymbolicLink()||entry.nlink!==1)throw new Error('REGULAR_PRIVATE_FILE_REQUIRED');
 const fd=openSync(file,'r+');let original:Buffer|undefined,updated:Buffer|undefined;let password='',confirmation='';
 try{
  const info=fstatSync(fd);if(info.dev!==entry.dev||info.ino!==entry.ino)throw new Error('CONFIGURATION_PATH_CHANGED');
  original=readDescriptor(fd);verifyLocalPaths(original.toString('utf8'));
  password=await readHiddenPassword(process.stdin,process.stdout,'Ham runtime parolasını gizli olarak girin: ');
  confirmation=await readHiddenPassword(process.stdin,process.stdout,'Aynı runtime parolasını tekrar girin: ');
  if(password!==confirmation)throw new Error('PASSWORD_CONFIRMATION_FAILED');
  updated=replaceRuntimePassword(original,password);password='';confirmation='';
  verifyIgnored();verifyLocalPaths(updated.toString('utf8'));
  const current=lstatSync(file);if(current.dev!==entry.dev||current.ino!==entry.ino||current.isSymbolicLink())throw new Error('CONFIGURATION_PATH_CHANGED');
  commitPasswordUpdate(fd,original,updated);
  process.stdout.write('Yalnızca DATABASE_URL parola bileşeni güncellendi; yerel yapılandırma doğrulandı. Canlı bağlantı yapılmadı.\n');
 }finally{
  password='';confirmation='';original?.fill(0);updated?.fill(0);closeSync(fd);process.stdin.pause();
 }
}
// Do not print arbitrary exceptions: URL parsers and filesystem errors can carry secrets.
const publicCodes=new Set(['EXPLICIT_OPERATOR_APPROVAL_REQUIRED','SECURE_TERMINAL_REQUIRED','PRIVATE_GIT_IGNORE_REQUIRED','REGULAR_PRIVATE_FILE_REQUIRED','CONFIGURATION_PATH_CHANGED','CONFIGURATION_CHANGED_DURING_PROMPT','APPROVAL_GATES_MUST_REMAIN_FALSE','CONFIGURATION_ASSIGNMENT_REVIEW_REQUIRED','SINGLE_LINE_URL_REQUIRED','AMBIGUOUS_DOTENV_VALUE','QUOTE_DELIMITER_REVIEW_REQUIRED','PASSWORD_CONFIRMATION_FAILED','PASSWORD_INPUT_REJECTED','SECRET_INPUT_REJECTED','SECRET_INPUT_CANCELLED','SECRET_INPUT_TIMEOUT','TERMINAL_RESTORE_FAILED','WRITE_FAILED_ORIGINAL_RESTORED','WRITE_FAILED_MANUAL_RECOVERY_REQUIRED','LOCAL_CA_FILE_REQUIRED','LOCAL_POSTGRES_TOOL_REQUIRED']);
main().catch(error=>{
 const code=error instanceof Error&&publicCodes.has(error.message)?error.message:'LOCAL_CONFIGURATION_UPDATE_STOPPED';
 const detail=code==='WRITE_FAILED_MANUAL_RECOVERY_REQUIRED'?'Dosya yazılamadı ve önceki içerik geri yüklenemedi. Dosyayı kullanmayın; yerel kurtarma incelemesi gerekir.':code==='WRITE_FAILED_ORIGINAL_RESTORED'?'Yazma başarısız; özgün dosya içeriği geri yüklendi.':'İşlem durduruldu. Güvenli TTY yoksa normal yerel PowerShell terminali kullanın; gizli giriş sağlanamıyorsa devam etmeyin.';
 process.stderr.write(code+': '+detail+' Gizli değerler gösterilmedi.\n');process.exitCode=1;
});
