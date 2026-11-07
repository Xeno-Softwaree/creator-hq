import type {EventEmitter} from 'node:events';

export interface SecretInput extends EventEmitter {
 isTTY?:boolean;isRaw?:boolean;readableEncoding?:string|null;readableFlowing?:boolean|null;
 setRawMode:(mode:boolean)=>unknown;resume:()=>unknown;pause:()=>unknown;isPaused:()=>boolean;
}
export interface SecretOutput {isTTY?:boolean;write:(text:string)=>unknown}
export function requireHiddenTerminal(input:SecretInput,output:SecretOutput){
 if(!input.isTTY||!output.isTTY||typeof input.setRawMode!=='function'||input.readableEncoding||input.listenerCount('data')||input.listenerCount('keypress')||input.listenerCount('readable'))throw new Error('SECURE_TERMINAL_REQUIRED');
}
// No readline/history, mask characters, clipboard integration or secret echo.
export function readHiddenPassword(input:SecretInput,output:SecretOutput,prompt:string,timeout=120000):Promise<string>{
 requireHiddenTerminal(input,output);
 const previousRaw=input.isRaw===true,previousPaused=input.isPaused()||input.readableFlowing!==true;
 try{input.setRawMode(true);if(input.isRaw!==true)throw new Error();}
 catch{try{input.setRawMode(previousRaw)}catch{}throw new Error('SECURE_TERMINAL_REQUIRED')}
 return new Promise((resolve,reject)=>{
  let secret='',finished=false;const decoder=new TextDecoder('utf-8',{fatal:true});
  const finish=(error?:string)=>{
   if(finished)return;finished=true;clearTimeout(timer);
   input.removeListener('data',onData);input.removeListener('error',onError);input.removeListener('end',onEnd);
   process.removeListener('SIGINT',onEnd);process.removeListener('SIGTERM',onEnd);
   try{input.setRawMode(previousRaw);if(previousPaused)input.pause();}
   catch{error='TERMINAL_RESTORE_FAILED'}
   const result=secret;secret='';
   try{output.write('\n')}catch{error='TERMINAL_OUTPUT_FAILED'}
   if(error)reject(new Error(error));else resolve(result);
  };
  const onError=()=>finish('SECRET_INPUT_FAILED');
  const onEnd=()=>finish('SECRET_INPUT_CANCELLED');
  const onData=(chunk:Buffer|string)=>{
   let value:string;try{value=typeof chunk==='string'?chunk:decoder.decode(chunk,{stream:true})}catch{finish('SECRET_INPUT_REJECTED');return}
   const characters=Array.from(value);
   for(let index=0;index<characters.length;index++){
    const character=characters[index];
    if(character==='\u0003'||character==='\u0004'){finish('SECRET_INPUT_CANCELLED');return}
    if(character==='\r'||character==='\n'){
     if(characters.slice(index+1).some(item=>item!=='\r'&&item!=='\n')||!secret){finish('SECRET_INPUT_REJECTED');return}
     try{decoder.decode()}catch{finish('SECRET_INPUT_REJECTED');return}
     finish();return;
    }
    if(character==='\b'||character==='\u007f'){secret=Array.from(secret).slice(0,-1).join('');continue;}
    if(/[\u0000-\u001f]/.test(character)||secret.length+character.length>4096){finish('SECRET_INPUT_REJECTED');return}
    secret+=character;
   }
  };
  const timer=setTimeout(()=>finish('SECRET_INPUT_TIMEOUT'),timeout);
  input.on('data',onData);input.on('error',onError);input.on('end',onEnd);
  process.once('SIGINT',onEnd);process.once('SIGTERM',onEnd);
  try{output.write(prompt);input.resume()}catch{finish('SECRET_INPUT_FAILED')}
 });
}
