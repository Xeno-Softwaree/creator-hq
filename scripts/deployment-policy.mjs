const storageKeys=['NEXT_PUBLIC_STORAGE_APP_PATH','NEXT_PUBLIC_STORAGE_VAULT_PATH','NEXT_PUBLIC_STORAGE_MEDIA_PATH','NEXT_PUBLIC_STORAGE_BACKUP_PATH'];
export function validateDeploymentEnvironment(environment){
 const findings=[];
 for(const [key,value] of Object.entries(environment)){if(key.startsWith('NEXT_PUBLIC_')&&(/(?:DATABASE|DIRECT_URL|MIGRATION_URL|SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY)/i.test(key)||(typeof value==='string'&&/^postgres(?:ql)?:/i.test(value))))findings.push({key,code:'DATABASE_SECRET_MUST_REMAIN_SERVER_SIDE'})}
 if(environment.NEXT_PUBLIC_DEPLOYMENT_MODE!=='public')return findings;
 for(const key of storageKeys){const value=environment[key];if(value&&(/^[A-Za-z]:[\\/]/.test(value)||/^[\\/]/.test(value)||/^[a-z][a-z0-9+.-]*:/i.test(value)))findings.push({key,code:'PUBLIC_STORAGE_PATH_MUST_BE_RELATIVE'});}
 if(environment.NEXT_PUBLIC_API_URL){try{const url=new URL(environment.NEXT_PUBLIC_API_URL);if(url.username||url.password)findings.push({key:'NEXT_PUBLIC_API_URL',code:'PUBLIC_URL_MUST_NOT_CONTAIN_CREDENTIALS'})}catch{findings.push({key:'NEXT_PUBLIC_API_URL',code:'INVALID_PUBLIC_API_URL'})}}
 return findings;
}
