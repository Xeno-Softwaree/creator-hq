import 'dotenv/config';
import type {PrismaClient as SqliteClient} from '@prisma/client';
import {databaseConfiguration} from './database/config.js';
const configuration=databaseConfiguration(process.env);
export const databaseProvider=configuration.provider;
let client:unknown;
if(configuration.provider==='postgresql'){
 const {PrismaClient}=await import('../generated/postgresql/index.js');
 client=new PrismaClient({datasources:{db:{url:configuration.url}},errorFormat:'minimal',log:[]});
}else {
 const {PrismaClient:SqliteClient}=await import('@prisma/client');
 client=new SqliteClient({datasources:{db:{url:configuration.url}},errorFormat:'minimal',log:[]});
}
// The established API uses the common six-model contract. PostgreSQL-only metadata is additive.
export const db=client as SqliteClient;
