import {execFileSync} from 'node:child_process';
import {accessSync,constants,lstatSync,readFileSync,realpathSync} from 'node:fs';
import {join,isAbsolute,resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
export function assertNormalWindowsUser(){
 if(process.platform!=='win32'||!process.env.SystemRoot)throw Error('CODEX_NORMAL_WINDOWS_USER_REQUIRED');
 try{const result=execFileSync(join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; $p=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()); if($p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){'elevated'}else{'standard'}"],{encoding:'utf8',stdio:['ignore','pipe','ignore'],windowsHide:true,timeout:10000});if(result.trim()!=='standard')throw Error();}catch{throw Error('CODEX_NORMAL_WINDOWS_USER_REQUIRED')}
}
export function assertPrivateOwnerDirectory(directory:string){
 try{const result=execFileSync(join(process.env.SystemRoot!,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; $me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $allowed=@($me,'S-1-5-18','S-1-5-32-544'); $rules=(Get-Acl -LiteralPath $env:CREATOR_PRIVATE_DIRECTORY).GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]); $unsafe=@($rules | Where-Object { $_.AccessControlType -eq 'Allow' -and $_.IdentityReference.Value -notin $allowed }); if($unsafe.Count -eq 0){'private'}else{'shared'}"],{env:{SystemRoot:process.env.SystemRoot,CREATOR_PRIVATE_DIRECTORY:directory},encoding:'utf8',stdio:['ignore','pipe','ignore'],windowsHide:true,timeout:10000});if(result.trim()!=='private')throw Error();}catch{throw Error('OWNER_PRIVATE_DIRECTORY_REQUIRED')}
}
export const runtimeSettingsSchema=z.object({codexExecutable:z.string(),scratchRoot:z.string(),codexHome:z.string(),nodeExecutable:z.string(),mcpIds:z.array(z.string().regex(/^[-A-Za-z0-9_@]{1,200}$/)).max(100),pluginIds:z.array(z.string().regex(/^[-A-Za-z0-9_@]{1,200}$/)).max(100),systemRoot:z.string(),userProfile:z.string(),expectedVersion:z.literal('0.166.0').default('0.166.0')}).strict();
export function loadRuntimeSettings(file:string|undefined,repository=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..')){
 if(!file)return undefined;
 try{const target=resolve(file),local=resolve(repository,'.local');if(!isAbsolute(file)||relative(local,target).startsWith('..')||!relative(local,target))throw Error();
  const info=lstatSync(target);if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size>16384||realpathSync(target).toLowerCase()!==target.toLowerCase())throw Error();
  const data=runtimeSettingsSchema.parse(JSON.parse(readFileSync(target,'utf8')));
  for(const key of ['codexExecutable','scratchRoot','codexHome','nodeExecutable','systemRoot','userProfile'] as const){if(!isAbsolute(data[key]))throw Error();const stat=lstatSync(data[key]);if(stat.isSymbolicLink()||(['codexExecutable','nodeExecutable'].includes(key)?!stat.isFile():!stat.isDirectory()))throw Error();}
  if(data.nodeExecutable.toLowerCase()!==process.execPath.toLowerCase())throw Error();
  if(!/^codex\.exe$/i.test(data.codexExecutable.split(/[\\/]/).at(-1)!))throw Error();
  const scratch=relative(local,resolve(data.scratchRoot));if(!scratch||scratch.startsWith('..'))throw Error();
  accessSync(data.scratchRoot,constants.R_OK|constants.W_OK);accessSync(data.codexExecutable,constants.R_OK);
  return data;
 }catch{throw Error('CODEX_LOCAL_CONFIGURATION_INVALID')}
}
