import {createHash} from 'node:crypto';
import {z} from 'zod';

export const agentIds=['ceo','director','research','niko','writer','editor','son','designer','analyst'] as const;
export const studioSchema=z.enum(['HQ','Niko','Son Yedek']);
export const permissionsSchema=z.object({tools:z.array(z.literal('text')).length(1),filesystem:z.literal('none'),network:z.literal('none'),database:z.literal('none'),publishing:z.literal(false),mcp:z.literal(false),hooks:z.literal(false)}).strict();
export const textPermissions=()=>permissionsSchema.parse({tools:['text'],filesystem:'none',network:'none',database:'none',publishing:false,mcp:false,hooks:false});
const roles={
 ceo:{studio:'HQ',instruction:'Human owner and final approval authority. Never execute as an automated agent.'},
 director:{studio:'HQ',instruction:'Coordinate production as Atlas. Propose bounded assignments; never approve jobs or widen permissions. Keep each studio context separate.'},
 research:{studio:'HQ',instruction:'Research strategy as Scout using supplied material only. Distinguish evidence from assumptions. Never invent sources or measured performance.'},
 niko:{studio:'Niko',instruction:'Lead Afterlight Stories. Plan English-language Shorts from the supplied Niko brief. Do not access Son Yedek context.'},
 writer:{studio:'Niko',instruction:'Write concise English Shorts scripts as Echo. Use supplied claims only. Return script text; do not create files or access other studios.'},
 editor:{studio:'Niko',instruction:'Plan edits and shot timing as Frame. Return a textual edit plan only; do not render, launch FFmpeg or open media.'},
 son:{studio:'Son Yedek',instruction:'Lead Son Yedek. Plan Turkish-language Reels using the supplied brief only. Do not access Niko context.'},
 designer:{studio:'Son Yedek',instruction:'Prepare visual directions as Pixel for Son Yedek. Return textual design briefs only; no image generation or asset access.'},
 analyst:{studio:'Son Yedek',instruction:'Analyze supplied observations as Pulse. Separate measured data from hypotheses. Never fabricate platform analytics or access accounts.'}
} as const;
export function agentPolicy(id:typeof agentIds[number]){return {version:1 as const,id,...roles[id],executable:id!=='ceo',permissions:textPermissions()};}
export const executionDraftSchema=z.object({taskId:z.string().min(1).max(100).nullable().default(null),title:z.string().trim().min(1).max(160),description:z.string().max(5000).default(''),agentId:z.enum(agentIds),studio:studioSchema}).strict();
export const contractSchema=z.object({version:z.literal(1),task:executionDraftSchema,profileVersion:z.literal(1),instructions:z.string().max(8000),scope:z.object({studio:studioSchema,context:z.literal('provided_text_only'),session:z.literal('fresh_job_only')}).strict(),permissions:permissionsSchema,mode:z.literal('preview'),enabled:z.literal(false),timeoutMs:z.number().int().min(10).max(120000)}).strict().superRefine((c,ctx)=>{
 const p=agentPolicy(c.task.agentId);
 if(!p.executable||p.studio!=='HQ'&&p.studio!==c.task.studio||c.scope.studio!==c.task.studio)ctx.addIssue({code:'custom',message:'EXECUTION_SCOPE_INVALID'});
 if(!c.instructions.startsWith(p.instruction))ctx.addIssue({code:'custom',message:'EXECUTION_POLICY_INVALID'});
});
export type ExecutionContract=z.infer<typeof contractSchema>;
export const jobStatuses=['planned','awaiting_approval','running','completed','failed','cancelled'] as const;
export function makeContract(input:unknown,profileInstructions=''):ExecutionContract{
 const task=executionDraftSchema.parse(input),p=agentPolicy(task.agentId);
 return contractSchema.parse({version:1,task,profileVersion:1,instructions:p.instruction+'\n'+profileInstructions,scope:{studio:task.studio,context:'provided_text_only',session:'fresh_job_only'},permissions:p.permissions,mode:'preview',enabled:false,timeoutMs:30000});
}
function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';return JSON.stringify(value);}
export function contractDigest(input:unknown){return createHash('sha256').update(canonical(contractSchema.parse(input))).digest('hex');}
export const approvalSchema=z.object({id:z.string().min(1),jobId:z.string().min(1),actorType:z.literal('human'),actorId:z.literal('owner'),digest:z.string().regex(/^[a-f0-9]{64}$/),decision:z.literal('approved'),expiresAt:z.number().int().positive()}).strict();
export type ExecutionApproval=z.infer<typeof approvalSchema>;
// Callers must load this record from a trusted server-side approval store, never from model output.
export function verifyApproval(contract:ExecutionContract,jobId:string,record:unknown,now=Date.now()){
 const a=approvalSchema.safeParse(record);
 if(!a.success||a.data.jobId!==jobId||a.data.expiresAt<=now||a.data.digest!==contractDigest(contract))throw new Error('EXECUTION_APPROVAL_INVALID');
 return a.data;
}
export function routeAssignment(intent:'coordinate'|'research'|'script'|'edit'|'design'|'analyze'|'lead',studio:z.infer<typeof studioSchema>){
 const id=intent==='coordinate'?'director':intent==='research'?'research':intent==='lead'?(studio==='Niko'?'niko':studio==='Son Yedek'?'son':'director'):intent==='script'?'writer':intent==='edit'?'editor':intent==='design'?'designer':'analyst';
 const p=agentPolicy(id);if(p.studio!=='HQ'&&p.studio!==studio)throw new Error('EXECUTION_SCOPE_INVALID');
 return {agentId:id,studio,proposedBy:'director',requiresHumanApproval:true,enabled:false};
}
