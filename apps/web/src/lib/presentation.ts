// Stored/API identifiers are immutable; these mappings only select presentation keys.
const pages: Record<string,string> = {
  "Overview": "nav.overview",
  "Office": "nav.office",
  "Task board": "nav.tasks",
  "Agents": "nav.agents",
  "Approvals": "nav.approvals",
  "Skill Center": "nav.skills",
  "Performance": "nav.performance",
  "Storage": "nav.storage"
};
const statuses: Record<string,string> = {
  "Backlog": "task.status.backlog",
  "In progress": "task.status.inProgress",
  "Review": "task.status.review",
  "Done": "task.status.done",
  "Pending": "approval.status.pending",
  "Approved": "approval.status.approved",
  "Rejected": "approval.status.rejected"
};
const roles: Record<string,string> = {
  "CEO & final approver": "agent.role.ceo",
  "Production director": "agent.role.director",
  "Research strategist": "agent.role.researcher",
  "Studio lead": "agent.role.studioLead",
  "Shorts scriptwriter": "agent.role.writer",
  "Video editor": "agent.role.editor",
  "Visual designer": "agent.role.designer",
  "Performance analyst": "agent.role.analyst"
};
export const pageKey=(value:string)=>pages[value]??'common.translationUnavailable';
export const statusKey=(value:string)=>statuses[value]??'common.translationUnavailable';
export const roleKey=(value:string)=>roles[value];
