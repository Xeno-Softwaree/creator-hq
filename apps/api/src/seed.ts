import { db } from './db.js';
import { simulationReport } from './reports.js';
const profiles = [
 ['ceo','You','CEO & final approver','HQ'],
 ['director','Atlas','Production director','HQ'],
 ['research','Scout','Research strategist','HQ'],
 ['niko','Niko','Studio lead','Niko'],
 ['writer','Echo','Shorts scriptwriter','Niko'],
 ['editor','Frame','Video editor','Niko'],
 ['son','Son','Studio lead','Son Yedek'],
 ['designer','Pixel','Visual designer','Son Yedek'],
 ['analyst','Pulse','Performance analyst','Son Yedek']
];
for (const [id,name,role,studio] of profiles) await db.agent.upsert({where:{id},update:{},create:{id,name,role,studio}});
// Upserts do not change an existing studio preference or any existing record.
for(const [id,contentLanguage] of [['Niko','en-US'],['Son Yedek','tr-TR']])await db.studioSettings.upsert({where:{id},update:{},create:{id,contentLanguage}});
for(const activity of await db.activity.findMany({where:{simulated:true,message:'SIMULATED: prepared a sample concept for human review. No process executed.'}})) {
 await db.agentReport.upsert({where:{sourceId:activity.id},update:{},create:{...simulationReport(activity.agentId,activity.id,undefined,activity.message),createdAt:activity.createdAt}});
}
await db.$disconnect();
