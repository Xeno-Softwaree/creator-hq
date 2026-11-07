// REVIEW GATE: operator-approved release edit only. Never an environment/HTTP switch.
export const NATIVE_EXECUTION_RELEASE_APPROVED:boolean=false;
// Reserved for one future operator-created job; this does not create a database row.
export const NATIVE_EXECUTION_JOB_ID:string='882eaab1-866c-4803-a93c-10442d0a993e';
export function permitsNativeJob(jobId:string,approved=NATIVE_EXECUTION_RELEASE_APPROVED,selected:string|null=NATIVE_EXECUTION_JOB_ID){
 return approved&&typeof selected==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(selected)&&jobId===selected;
}
