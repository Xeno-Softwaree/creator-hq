import {execFileSync} from 'node:child_process';
import {existsSync,writeFileSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {url as inspectorUrl} from 'node:inspector';
import {requireHiddenTerminal,readHiddenPassword} from '../database/hidden-password.js';
import {ownerPasswordHash} from './owner.js';
import {assertNormalWindowsUser,assertPrivateOwnerDirectory} from './windows-host.js';
export function ownerEnvironment(password:string,confirmation:string){
 if(password!==confirmation)throw Error('OWNER_PASSWORD_CONFIRMATION_FAILED');
 if(password.length<16||password.length>256||/[\u0000-\u001f\u007f]/.test(password))throw Error('OWNER_PASSWORD_LENGTH_INVALID');
 return 'CREATOR_OWNER_PASSWORD_HASH='+ownerPasswordHash(password)+'\r\n';
}
async function main(){
 if(process.argv.length!==3||process.argv[2]!=='--operator-approved')throw Error('OWNER_PREPARATION_APPROVAL_REQUIRED');
 if(inspectorUrl()||process.env.NODE_OPTIONS||process.env.NODE_DEBUG||process.env.DEBUG||process.execArgv.some(x=>/^--(?:inspect|debug|trace|heap|prof|cpu|report)/.test(x)))throw Error('SECURE_TERMINAL_REQUIRED');
 assertNormalWindowsUser();requireHiddenTerminal(process.stdin,process.stdout);
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..'),directory=resolve(root,'.local/owner-auth'),file=resolve(directory,'owner.env');
 if(!existsSync(directory)||lstatSync(directory).isSymbolicLink()||realpathSync(directory).toLowerCase()!==directory.toLowerCase()||existsSync(file))throw Error('OWNER_PRIVATE_TARGET_REVIEW_REQUIRED');
 assertPrivateOwnerDirectory(directory);
 execFileSync('git',['check-ignore','--quiet','--','.local/owner-auth/owner.env'],{cwd:root,stdio:'ignore',timeout:5000});
 if(execFileSync('git',['ls-files','--cached','--','.local/owner-auth/owner.env'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim())throw Error('OWNER_PRIVATE_TARGET_REVIEW_REQUIRED');
 let password='',confirmation='',content='';
 try{password=await readHiddenPassword(process.stdin,process.stdout,'Yeni CEO parolası (en az 16 karakter): ');confirmation=await readHiddenPassword(process.stdin,process.stdout,'CEO parolasını tekrar girin: ');content=ownerEnvironment(password,confirmation);password='';confirmation='';
  if(realpathSync(directory).toLowerCase()!==directory.toLowerCase())throw Error('OWNER_PRIVATE_TARGET_REVIEW_REQUIRED');
  writeFileSync(file,content,{flag:'wx',mode:0o600});process.stdout.write('CEO parola özeti özel hazırlık dosyasına kaydedildi. Uygulama yapılandırması değiştirilmedi.\n');
 }finally{password='';confirmation='';content='';process.stdin.pause()}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{process.stderr.write('OWNER_PREPARATION_STOPPED: Gizli bilgiler gösterilmedi; mevcut yapılandırma korunuyor.\n');process.exitCode=1});
