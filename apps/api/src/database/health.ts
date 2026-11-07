import type {Environment} from './config.js';

export function healthBudgetMs(environment:Environment):number {
 if(environment.HEALTH_TIMEOUT_MS!==undefined){
  const value=Number(environment.HEALTH_TIMEOUT_MS);
  if(!Number.isInteger(value)||value<1000||value>60000)throw new Error('INVALID_HEALTH_TIMEOUT');
  return value;
 }
 if(environment.DATABASE_PROVIDER!=='postgresql')return 5000;
 const url=new URL(environment.DATABASE_URL!);
 const values=['connect_timeout','pool_timeout','socket_timeout'].map(key=>Number(url.searchParams.get(key)));
 if(values.some(v=>!Number.isInteger(v)||v<1)||values.reduce((a,b)=>a+b,0)>60)throw new Error('BOUNDED_HEALTH_TIMEOUT_REQUIRED');
 return values.reduce((a,b)=>a+b,0)*1000;
}

export async function withinDeadline<T>(operation:Promise<T>,milliseconds:number):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([operation,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('HEALTH_TIMEOUT'),{code:'HEALTH_TIMEOUT'})),milliseconds)})])}
 finally{if(timer)clearTimeout(timer)}
}

// A timed-out driver operation can still be settling. Share health reads rather than
// spawning more queries. This never retries a query or handles a write request.
export function createHealthProbe(operation:()=>Promise<void>,milliseconds:number){
 let pending:Promise<void>|undefined;
 return ()=>{
  pending??=Promise.resolve().then(operation).finally(()=>{pending=undefined});
  return withinDeadline(pending,milliseconds);
 };
}
