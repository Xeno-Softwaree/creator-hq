import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import ts from 'typescript';
import {localeRegistry,supportedLocales} from '../locales';
import {pageKey,statusKey,roleKey} from './presentation';
const official=new Set(['C','↗','CREATOR','CREATOR HQ','CH','Y','/','Afterlight Stories','/ Niko','Son Yedek','—','·','(en-US)','(tr-TR)']);
function files(directory:string):string[]{return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(directory,entry.name)):/\.tsx?$/.test(entry.name)?[join(directory,entry.name)]:[])}
test('all React copy and semantic key references are centrally covered',()=>{
 const violations:string[]=[];
 const dictionaries=supportedLocales.map(locale=>localeRegistry[locale].messages);
 for(const path of files('src').filter(path=>!path.endsWith('.test.ts'))){
  const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  function check(key:string){if(dictionaries.some(messages=>!Object.hasOwn(messages,key)))violations.push(`${path}: missing key ${key}`)}
  function visit(node:ts.Node){
   if(ts.isJsxText(node)){const text=node.text.trim();if(text&&!official.has(text))violations.push(`${path}: hardcoded JSX text`)}
   if(ts.isJsxAttribute(node)&&['aria-label','title','placeholder','alt'].includes(node.name.getText(source))&&node.initializer&&ts.isStringLiteral(node.initializer)&&node.initializer.text.trim())violations.push(`${path}: hardcoded accessible copy`);
   if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&['t','translate'].includes(node.expression.text)){const argument=node.arguments[node.expression.text==='translate'?1:0];if(argument&&ts.isStringLiteral(argument))check(argument.text)}
   if(ts.isStringLiteral(node)&&/^(?:copy|nav|task|approval|agent|studio|office|language|common|sidebar|dashboard|activity|metadata|report|error|execution)\.[A-Za-z0-9_.]+$/.test(node.text))check(node.text);
   ts.forEachChild(node,visit);
  }
  visit(source);
 }
 assert.deepEqual(violations,[]);
});
test('source identifiers stay ASCII English-compatible; protocol label mappings resolve',()=>{
 const violations:string[]=[];
 for(const path of [...files('src'),...files('../api/src')]){const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);function visit(node:ts.Node){if(ts.isIdentifier(node)&&(/[^\x00-\x7F]/.test(node.text)||/^(?:gorev|ajan|onay|dil|ceviri|depolama|islem|dosya|baslik|icerik|durum)(?:$|[A-Z_])/.test(node.text)))violations.push(path);ts.forEachChild(node,visit)}visit(source)}
 assert.deepEqual(violations,[]);
 const keys=[...['Overview','Office','Task board','Agents','Approvals','Skill Center','Performance','Storage'].map(pageKey),...['Backlog','In progress','Review','Done','Pending','Approved','Rejected'].map(statusKey),...['CEO & final approver','Production director','Research strategist','Studio lead','Shorts scriptwriter','Video editor','Visual designer','Performance analyst'].map(roleKey)];
 for(const key of keys){assert.ok(key);for(const locale of supportedLocales)assert.ok(Object.hasOwn(localeRegistry[locale].messages,key!))}
});
