import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { existsSync, mkdirSync, closeSync, openSync } from 'node:fs';
if(process.env.DATABASE_PROVIDER==='postgresql'||(process.env.DATABASE_URL&&!process.env.DATABASE_URL.startsWith('file:')))throw new Error('USE_REVIEWED_POSTGRES_MIGRATION_COMMANDS');
process.env.DATABASE_PROVIDER??='sqlite';
process.env.DATABASE_URL ??= 'file:./creator.db';
// Prisma 6 on Windows needs an existing SQLite file before schema push.
if(process.env.DATABASE_URL.startsWith('file:')) {
 const path=resolve('prisma',process.env.DATABASE_URL.slice(5));
 mkdirSync(dirname(path),{recursive:true});
 if(!existsSync(path))closeSync(openSync(path,'wx'));
}
const cli=resolve('../../node_modules/prisma/build/index.js');
for(const args of [['generate'],['db','push']]) execFileSync(process.execPath,[cli,...args],{stdio:'inherit',env:process.env});
await import('./seed.js');
