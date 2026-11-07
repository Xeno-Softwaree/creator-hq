import { buildApp } from './app.js';
import {db,databaseProvider} from './db.js';
import {verifyPostgresStartup} from './database/startup.js';
import {withinDeadline,healthBudgetMs} from './database/health.js';
import {databaseErrorCode} from './database/errors.js';
async function main(){
 if(databaseProvider==='postgresql')await withinDeadline((async()=>{
  await db.$connect();
  await verifyPostgresStartup(sql=>db.$queryRawUnsafe<Record<string,unknown>[]>(sql));
 })(),healthBudgetMs(process.env));
 const app=await buildApp();
 await app.listen({host:'127.0.0.1',port:Number(process.env.PORT??4100)});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0)});
}
main().catch(async error=>{
 console.error('API_STARTUP_FAILED: '+(databaseErrorCode(error)??'STARTUP_VALIDATION_FAILED'));
 await db.$disconnect();process.exitCode=1;
});
