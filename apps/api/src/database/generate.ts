import 'dotenv/config';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const cli=resolve('../../node_modules/prisma/build/index.js');
for(const schema of ['prisma/schema.prisma','prisma/postgresql/schema.prisma'])execFileSync(process.execPath,[cli,'generate','--schema',schema],{stdio:'inherit',env:{...process.env,DATABASE_URL:schema.includes('postgresql')?'postgresql://localhost:5432/creator_hq?schema=creator_hq':process.env.DATABASE_PROVIDER==='postgresql'?'file:./creator.db':process.env.DATABASE_URL??'file:./creator.db',DIRECT_URL:'postgresql://localhost:5432/creator_hq?schema=creator_hq'}});
