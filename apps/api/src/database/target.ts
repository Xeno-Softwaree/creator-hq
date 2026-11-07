import {PrismaClient} from '../../generated/postgresql/index.js';
import type {SqlTarget} from './transfer.js';
export function prismaTarget(client:PrismaClient):SqlTarget {
 return {query:async(sql,parameters=[])=>/^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql)?(await client.$executeRawUnsafe(sql,...parameters),[]):client.$queryRawUnsafe<Record<string,unknown>[]>(sql,...parameters),transaction:operation=>client.$transaction(async tx=>operation({query:async(sql,parameters=[])=>/^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql)?(await tx.$executeRawUnsafe(sql,...parameters),[]):tx.$queryRawUnsafe<Record<string,unknown>[]>(sql,...parameters),transaction:()=>{throw new Error('NESTED_TRANSACTION_NOT_SUPPORTED')}}),{isolationLevel:'Serializable',maxWait:10000,timeout:60000})};
}
export {PrismaClient};
