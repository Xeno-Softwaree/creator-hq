// Deterministic records only. No process spawning, translation services or model calls.
export type ReportSource = 'simulation' | 'manual' | 'legacy_simulation';
export type ReportStatus = 'completed' | 'awaiting_approval' | 'blocked' | 'failed' | 'partial';
export interface CeoExecutionAdapter {
 readonly authenticated: boolean;
 readonly enabled: boolean;
 summarize(input: {originalTechnicalReport:string;locale:'tr-TR'|'en-US'}): Promise<string>;
}
export const disabledCeoAdapter: CeoExecutionAdapter = {
 authenticated:false, enabled:false,
 async summarize(){throw new Error('CODEX_RUNTIME_DISABLED')}
};
export function simulationReport(agentId:string,sourceId:string,approvalId?:string,original='SIMULATED: prepared a sample concept for human review. No process executed.') {
 return {sourceId,agentId,approvalId,source:approvalId?'simulation':'legacy_simulation',status:approvalId?'awaiting_approval':'completed',summaryData:JSON.stringify({template:'simulation'}),originalTechnicalReport:original};
}
export function completionReport(task:{id:string;title:string;agentId:string;updatedAt:Date}) {
 return {sourceId:`task:${task.id}:${task.updatedAt.toISOString()}`,agentId:task.agentId,taskId:task.id,source:'manual',status:'completed',summaryData:JSON.stringify({template:'task_marked_done',title:task.title}),originalTechnicalReport:JSON.stringify({event:'TASK_MARKED_DONE',taskId:task.id,title:task.title,status:'Done',execution:'disabled',artifacts:[]},null,2)};
}
