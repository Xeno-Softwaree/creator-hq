import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import type {ChildProcessWithoutNullStreams} from 'node:child_process';
// In-memory wire fixture: cannot spawn any OS process or access authentication files.
export type ProtocolFixture={config:unknown;accountType?:string;version?:string;chunks:(string|Buffer)[];exitCode?:number;stderr?:string;earlyClose?:boolean;hang?:boolean;calls?:string[]};
export function protocolChild(mode:'preflight'|'exec'|'version',fixture:ProtocolFixture):ChildProcessWithoutNullStreams {
 if(process.env.NODE_ENV!=='test')throw Error('EXECUTION_FAKE_TEST_ONLY');
 const child=new EventEmitter() as any;child.stdout=new PassThrough();child.stderr=new PassThrough();let closed=false,buffer='';
 const close=(code=0)=>{if(closed)return;closed=true;child.stdout.end();child.stderr.end();queueMicrotask(()=>child.emit('close',code,null))};
 const output=(data:unknown)=>child.stdout.write(JSON.stringify(data)+'\n');
 child.kill=()=>{close();return true};child.stdin=new Writable({write(chunk,_encoding,done){buffer+=String(chunk);if(mode==='preflight'){const lines=buffer.split('\n');buffer=lines.pop()!;for(const line of lines){const message=JSON.parse(line);fixture.calls?.push(message.method);if(fixture.earlyClose){close(5);continue}if(message.id===1)output({id:1,result:{}});if(message.id===2)output({id:2,result:{config:fixture.config}});if(message.id===3)output({id:3,result:{account:{type:fixture.accountType??'chatgpt'}}});}}done()},final(done){if(mode==='exec'){fixture.calls?.push('exec');if(!fixture.hang){if(fixture.stderr)child.stderr.write(fixture.stderr);for(const chunk of fixture.chunks)if(!closed)child.stdout.write(chunk);close(fixture.exitCode??0)}}done()}});
 queueMicrotask(()=>{child.emit('spawn');if(mode==='version'){child.stdout.write('codex-cli '+(fixture.version??'0.166.0'));close()}});return child;
}
