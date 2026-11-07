import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
export type Owner={id:'owner';sessionAudit:string};
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export function ownerPasswordHash(password:string,salt=randomBytes(16).toString('hex')){return `scrypt:${salt}:${scryptSync(password,salt,32).toString('hex')}`;}
export class OwnerSessions {
 private sessions=new Map<string,{csrf:string;expires:number;audit:string}>();
 private failures=new Map<string,{count:number;until:number}>();
 constructor(private readonly passwordHash:string|undefined,private readonly clock=Date.now){}
 get configured(){return /^scrypt:[a-f0-9]{32}:[a-f0-9]{64}$/.test(this.passwordHash??'');}
 login(password:unknown,client:string){
  if(!this.configured)throw Error('OWNER_AUTH_UNCONFIGURED');
  const now=this.clock();for(const [k,s] of this.sessions)if(s.expires<=now)this.sessions.delete(k);
  for(const [k,f] of this.failures)if(f.until<=now)this.failures.delete(k);
  const f=this.failures.get(client);if(f&&f.count>=5)throw Error('OWNER_AUTH_RATE_LIMITED');
  const [,salt,expected]=this.passwordHash!.split(':');
  const valid=typeof password==='string'&&password.length>=12&&password.length<=256&&timingSafeEqual(scryptSync(password,salt,32),Buffer.from(expected,'hex'));
  if(!valid){if(this.failures.size>=100&&!f)throw Error('OWNER_AUTH_RATE_LIMITED');this.failures.set(client,{count:(f?.count??0)+1,until:f?.until??now+600000});throw Error('OWNER_AUTH_FAILED');}
  this.failures.delete(client);if(this.sessions.size>=16)throw Error('OWNER_AUTH_RATE_LIMITED');
  const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');this.sessions.set(hash(token),{csrf,expires:now+3600000,audit:randomBytes(16).toString('hex')});return {token,csrf};
 }
 authenticate(cookie:string|undefined,csrf?:string,mutation=false){
  const token=cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('creator_owner='))?.slice('creator_owner='.length);
  const session=token&&/^[a-f0-9]{64}$/.test(token)?this.sessions.get(hash(token)):undefined;
  if(!session||session.expires<=this.clock())throw Error('OWNER_AUTH_REQUIRED');
  if(mutation&&csrf!==session.csrf)throw Error('OWNER_CSRF_INVALID');
  return {owner:{id:'owner' as const,sessionAudit:session.audit},csrf:session.csrf};
 }
 logout(cookie:string|undefined){const token=cookie?.match(/(?:^|;\s*)creator_owner=([a-f0-9]{64})(?:;|$)/)?.[1];if(token)this.sessions.delete(hash(token));}
}
