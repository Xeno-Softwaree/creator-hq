import {createReadStream,existsSync,lstatSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {homedir} from 'node:os';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertNormalWindowsUser,assertPrivateOwnerDirectory,loadRuntimeSettings} from './windows-host.js';
export function integrationHeader(line:string):{kind:'mcp_servers'|'plugins';id:string}|null{
 if(!/^\s*\[\s*(mcp_servers|plugins)\./.test(line))return null;
 const match=line.match(/^\s*\[\s*(mcp_servers|plugins)\.("(?:[^"\\]|\\.)*"|'[^']*'|[-A-Za-z0-9_@]+)(\.env)?\s*\]\s*(?:#.*)?$/);
 if(!match)throw Error('INTEGRATION_INVENTORY_REVIEW_REQUIRED');
 if(match[3]&&match[1]!=='mcp_servers')throw Error('INTEGRATION_INVENTORY_REVIEW_REQUIRED');
 const id=match[2].startsWith('"')?JSON.parse(match[2]):match[2].startsWith("'")?match[2].slice(1,-1):match[2];if(!/^[-A-Za-z0-9_@]{1,200}$/.test(id))throw Error('INTEGRATION_INVENTORY_REVIEW_REQUIRED');
 return {kind:match[1] as 'mcp_servers'|'plugins',id};
}
async function main(){
 if(process.argv.length!==3||process.argv[2]!=='--prepare-only')throw Error('PREPARATION_ONLY_REQUIRED');assertNormalWindowsUser();
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..'),owner=join(root,'.local/owner-auth');assertPrivateOwnerDirectory(owner);
 const file=join(owner,'codex-runtime.json'),scratch=join(owner,'jobs');if(existsSync(file)||existsSync(scratch))throw Error('PRIVATE_CONFIGURATION_ALREADY_EXISTS');
 const home=process.env.CODEX_HOME||join(homedir(),'.codex');const prior=JSON.parse(readFileSync(join(root,'.local/phase20-trial/preflight-location.json'),'utf8'));
 if(typeof prior.bin!=='string'||!/[\\/]codex\.exe$/i.test(prior.bin)||!lstatSync(prior.bin).isFile())throw Error('REVIEWED_NATIVE_BINARY_REQUIRED');
 const ids={mcp_servers:new Set<string>(),plugins:new Set<string>()};
 // Only section headers are interpreted; values and authentication files are never inspected.
 const lines=createInterface({input:createReadStream(join(home,'config.toml')),crlfDelay:Infinity});for await(const line of lines){if(line.length>32768)throw Error('INTEGRATION_INVENTORY_REVIEW_REQUIRED');const entry=integrationHeader(line);if(entry)ids[entry.kind].add(entry.id)}
 const config={codexExecutable:prior.bin,scratchRoot:scratch,codexHome:home,nodeExecutable:process.execPath,mcpIds:[...ids.mcp_servers].sort(),pluginIds:[...ids.plugins].sort(),systemRoot:process.env.SystemRoot,userProfile:process.env.USERPROFILE,expectedVersion:'0.166.0'};
 mkdirSync(scratch);writeFileSync(file,JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600});loadRuntimeSettings(file,root);
 process.stdout.write(JSON.stringify({runtimeConfigurationPrepared:true,mcpRecords:config.mcpIds.length,pluginRecords:config.pluginIds.length,authenticationFilesRead:0,cliLaunches:0,executionEnabled:false})+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{process.stderr.write('RUNTIME_PREPARATION_STOPPED: Gizli değerler gösterilmedi; mevcut yapılandırma değiştirilmedi.\n');process.exitCode=1});
