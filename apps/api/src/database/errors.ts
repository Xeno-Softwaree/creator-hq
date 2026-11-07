const unavailableCodes=new Set(['P1000','P1001','P1002','P1008','P1011','P1017','P2024']);
export function databaseErrorCode(error:unknown):string|undefined {
 if(!error||typeof error!=='object')return undefined;
 const e=error as {code?:unknown;errorCode?:unknown;name?:unknown};
 // Initialization errors use errorCode; known request errors use code.
 const code=typeof e.code==='string'?e.code:e.name==='PrismaClientInitializationError'?e.errorCode:undefined;
 return typeof code==='string'&&/^P\d{4}$/.test(code)?code:undefined;
}
export const isDatabaseUnavailable=(error:unknown)=>unavailableCodes.has(databaseErrorCode(error)??'');
