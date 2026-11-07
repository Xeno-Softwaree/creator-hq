export const executionStatuses=['planned','awaiting_approval','running','completed','failed','cancelled'] as const;
export function executionStatusKey(status:string){return executionStatuses.includes(status as typeof executionStatuses[number])?`execution.status.${status}`:'execution.status.unknown';}
export function executionSourceKey(source:string){return source==='codex'?'execution.source.codex':source==='simulation'||source==='legacy_simulation'?'execution.source.simulation':source==='manual'?'copy.localBoardUpdate':source==='preview'?'execution.source.preview':'execution.source.unknown';}
// Keep Strict owner cookies same-site when the operator opens either loopback hostname.
export function executionApiOrigin(configured:string,hostname?:string){const url=new URL(configured);if(hostname&&['localhost','127.0.0.1'].includes(hostname)&&['localhost','127.0.0.1'].includes(url.hostname))url.hostname=hostname;return url.toString().replace(/\/$/,'');}
