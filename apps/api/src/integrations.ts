// Contracts only. Phase 1 never launches processes or contacts services.
export interface ExecutionRequest { taskId: string; agentId: string; approvedBy: string }
export interface IntegrationAdapter { available: boolean; execute(request: ExecutionRequest): Promise<never> }
export const integrations = ['Codex CLI', 'Remotion', 'Obsidian', 'ECC skills', 'YouTube skills'].map(name => ({name, status:'planned', enabled:false}));
