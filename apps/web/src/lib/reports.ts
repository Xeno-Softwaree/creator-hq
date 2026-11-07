export type Report = {id:string;agentId:string;taskId?:string|null;approvalId?:string|null;source:string;status:string;summaryData:string;originalTechnicalReport:string;createdAt:string};
type Translate=(key:string,params?:Record<string,string|number>)=>string;
export function summarizeReport(report:Report,t:Translate) {
 let data:{template?:string;title?:string;summary?:string;actions?:string[]}={};try{data=JSON.parse(report.summaryData)}catch{}
 if(data.template==='execution_result')return [[t("report.section.actions"),typeof data.summary==='string'?data.summary:t("execution.jobs.reportActions")],[t("report.section.files"),t("copy.noFilesOrArtifactsWereGenerated")],[t("report.section.status"),t(report.status==='awaiting_approval'?"report.status.awaitingApproval":report.status==='completed'?"report.status.completed":"report.status.failed")],[t("report.section.warnings"),t("execution.jobs.reportWarning")],[t("report.section.nextSteps"),Array.isArray(data.actions)?data.actions.filter(x=>typeof x==='string').join('\n'):t("execution.jobs.reportWarning")],[t("report.section.approval"),t(report.status==='awaiting_approval'?"copy.humanReviewRequired":"execution.jobs.approvalRecorded")]];
 const simulation=data.template==='simulation';
 const manual=data.template==='task_marked_done';
 const known=simulation||manual;
 const status:Record<string,string>={completed:"report.status.completed",failed:"report.status.failed",partial:"report.status.partial",blocked:"report.status.blocked",awaiting_approval:"report.status.awaitingApproval"};
 return [
  [t("report.section.actions"),simulation?t("copy.simulationCompletedNoRealProcessWasExecuted"):manual?t("copy.operatorMarkedTaskTitleAsDoneOnThe",{title:typeof data.title==='string'?data.title:report.taskId??'—'}):t("copy.unknownReportTemplateInspectTheOriginalTechnicalReport")],
  [t("report.section.files"),known?t("copy.noFilesOrArtifactsWereGenerated"):t("copy.unknownReportTemplateInspectTheOriginalTechnicalReport")],
  [t("report.section.status"),t(status[report.status]??"copy.unknownReportTemplateInspectTheOriginalTechnicalReport")],
  [t("report.section.warnings"),simulation?t("copy.noErrorsWereRecordedByThisSimulation"):manual?t("copy.aBoardStatusChangeDoesNotVerifyAgent"):t("copy.unknownReportTemplateInspectTheOriginalTechnicalReport")],
  [t("report.section.nextSteps"),simulation?(report.source==='legacy_simulation'?t("copy.originalSimulationEventRetainedNoExecutionOrApproval"):report.status==='awaiting_approval'?t("copy.reviewTheSimulatedConceptAndDecideWhetherTo"):t("copy.reviewRecordedIntegrationsRemainDisabled")):t("copy.noExecutionFollowsAnApprovalInThisPhase")],
  [t("report.section.approval"),report.status==='awaiting_approval'?t("copy.humanReviewRequired"):t("copy.noExecutionApprovalRequested")]
 ];
}
