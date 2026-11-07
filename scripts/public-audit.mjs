import {execFileSync} from 'node:child_process';
import {readFileSync,lstatSync} from 'node:fs';
import {extname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const binaryExtensions=new Set(['.db','.sqlite','.sqlite3','.png','.jpg','.jpeg','.webp','.gif','.mp4','.mov','.mkv','.avi','.webm','.mp3','.wav','.m4a','.flac','.pdf','.zip','.7z','.gz','.tar','.dump','.sql','.bak','.backup','.pem','.key','.p12','.pfx']);
export function inspectPublicFile(path,content=''){
 const findings=[];const normalized=path.replaceAll('\\','/');
 if(/(^|\/)(?:private|vaults|media-work|renders|exports|backups|logs|\.local|\.obsidian|\.supabase)(\/|$)/i.test(normalized))findings.push('private-directory');
 if(/(^|\/)\.env(?:\..*)?$/.test(normalized)&&!normalized.endsWith('.env.example'))findings.push('environment-file');
 const reviewedSql=["apps/api/prisma/postgresql/migrations/20261107000100_phase20_atlas_text/migration.sql",'apps/api/prisma/postgresql/review/atlas-activation.sql','apps/api/prisma/postgresql/review/atlas-rollback.sql','apps/api/prisma/postgresql/migrations/20261106000100_phase12_initial/migration.sql','apps/api/prisma/postgresql/security/bootstrap-role.sql','apps/api/prisma/postgresql/security/prepare-schema.sql','apps/api/prisma/postgresql/security/inspect-security.sql','apps/api/prisma/postgresql/security/inspect-existing-data.sql','apps/api/prisma/postgresql/security/inspect-runtime-connection.sql'].includes(normalized);
 if((binaryExtensions.has(extname(normalized).toLowerCase())&&!reviewedSql)||/\.(?:db|sqlite)(?:-|\.)|\.log$|\.jsonl$/i.test(normalized))findings.push('private-or-generated-artifact');
 if(/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/.test(content))findings.push('private-key');
 if(/\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}/.test(content)||/\bgh[pousr]_[A-Za-z0-9]{24,}/.test(content))findings.push('credential-token');
 if(/postgres(?:ql)?:\/\/[^\s"'<>]+:[^\s"'<>]+@/i.test(content)||/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16,}/.test(content))findings.push('connection-secret');
 if(/\b[A-Za-z]:[\\/](?:Users[\\/][^\s"'<>]+|[^\s"'<>]+)/.test(content)||/\/(?:home|Users)\/[^\s"'<>]+\//.test(content))findings.push('machine-specific-absolute-path');
 return findings;
}
export function auditPublicFiles(root=process.cwd()){
 // Include tracked files even if newly ignored; ignore rules cannot sanitize existing Git history.
 const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
 const findings=[];
 for(const path of new Set(files)){
  const full=resolve(root,path);const stat=lstatSync(full);
  if(stat.isSymbolicLink()){findings.push({path,rule:'unreviewed-symlink'});continue;}
  if(stat.size>2*1024*1024){findings.push({path,rule:'oversized-public-file'});continue;}
  const content=readFileSync(full).toString('utf8');
  for(const rule of inspectPublicFile(path,content))findings.push({path,rule});
 }
 return {scannedFiles:new Set(files).size,findings};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=auditPublicFiles();console.log(JSON.stringify(result,null,2));if(result.findings.length)process.exitCode=1;
}
