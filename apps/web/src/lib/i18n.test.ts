import {test} from 'node:test';
import assert from 'node:assert/strict';
import tr from '../locales/tr-TR.json';
import en from '../locales/en-US.json';
import {DEFAULT_LOCALE,LANGUAGE_KEY,resolveLocale,translate,localizedActivity,formatDate,formatNumber} from './i18n';
import {summarizeReport,type Report} from './reports';
test('Turkish default, safe locale resolution and complete dictionaries',()=>{
 assert.equal(DEFAULT_LOCALE,'tr-TR');assert.equal(resolveLocale(null),'tr-TR');assert.equal(resolveLocale('fr-FR'),'tr-TR');assert.equal(resolveLocale('en-US'),'en-US');assert.equal(LANGUAGE_KEY,'creator-hq.locale');
 assert.deepEqual(Object.keys(tr).sort(),Object.keys(en).sort());for(const value of [...Object.values(tr),...Object.values(en)])assert.ok(value.trim());
 for(const key of ['nav.overview','nav.office','nav.tasks','nav.agents','nav.approvals','nav.skills','nav.performance','nav.storage','office.room.hq','office.room.niko','office.room.son']){assert.notEqual(translate('tr-TR',key),translate('en-US',key));}
 assert.equal(translate('en-US','missing',{}, {'tr-TR':{missing:'Türkçe yedek'},'en-US':{}}),'Türkçe yedek');assert.equal(translate('en-US','unrecognized'),'Çeviri kullanılamıyor');assert.equal(translate('tr-TR','__proto__'),'Çeviri kullanılamıyor');assert.equal(translate('tr-TR','toString'),'Çeviri kullanılamıyor');
 assert.equal(formatNumber(1234.5,'tr-TR'),'1.234,5');assert.equal(formatNumber(1234.5,'en-US'),'1,234.5');assert.notEqual(formatDate('2026-11-05T12:00:00Z','tr-TR'),formatDate('2026-11-05T12:00:00Z','en-US'));assert.equal(formatDate('invalid','tr-TR'),'—');
});
test('routine activities localized while user content and technical identifiers remain verbatim',()=>{
 const t=(key:string,params?:Record<string,string|number>)=>translate('tr-TR',key,params);
 assert.equal(localizedActivity('Task created: Keep Niko English / workspace/path',t),'Görev oluşturuldu: Keep Niko English / workspace/path');assert.equal(localizedActivity('User-defined technical report E_ACCESS',t),'User-defined technical report E_ACCESS');
});
test('CEO reports have six localized sections, preserve original, and never invent execution',()=>{
 const original='E_ACCESS workspace/file.ts';
 const report:Report={id:'report',agentId:'niko',source:'simulation',status:'awaiting_approval',summaryData:JSON.stringify({template:'simulation'}),originalTechnicalReport:original,createdAt:'2026-11-05T12:00:00Z'};
 const turkish=summarizeReport(report,(key,params)=>translate('tr-TR',key,params));const english=summarizeReport(report,(key,params)=>translate('en-US',key,params));
 assert.deepEqual(turkish.map(row=>row[0]),['Yapılan İşlemler','Oluşturulan Dosyalar','Görev Durumu','Hatalar ve Uyarılar','Sonraki Adımlar','Onay Gereksinimi']);assert.equal(english[0][0],'Actions performed');assert.match(turkish[0][1],/gerçek bir süreç çalıştırılmadı/);assert.equal(report.originalTechnicalReport,original);
 const manual=summarizeReport({...report,source:'manual',status:'completed',summaryData:JSON.stringify({template:'task_marked_done',title:'Do not translate my title'})},(key,params)=>translate('tr-TR',key,params));assert.match(manual[0][1],/Do not translate my title/);assert.match(manual[3][1],/doğrulamaz/);
 const unknown=summarizeReport({...report,summaryData:'invalid'},(key,params)=>translate('tr-TR',key,params));assert.match(unknown[0][1],/tanınmıyor/);
});
test('execution report summaries preserve text, provenance and human review in both languages',()=>{
 const report:Report={id:'fixture',agentId:'director',source:'simulation',status:'awaiting_approval',summaryData:JSON.stringify({template:'execution_result',summary:'Untranslated supplied output',actions:['Review supplied text']}),originalTechnicalReport:'Synthetic report',createdAt:'2026-11-05T12:00:00Z'};
 for(const locale of ['tr-TR','en-US'] as const){const rows=summarizeReport(report,(key,params)=>translate(locale,key,params));assert.equal(rows.length,6);assert.equal(rows[0][1],'Untranslated supplied output');assert.equal(rows[4][1],'Review supplied text');assert.equal(rows[5][1],translate(locale,'copy.humanReviewRequired'));assert.ok(rows.every(row=>row.every(text=>!text.startsWith('execution.'))));}assert.equal(report.source,'simulation');assert.equal(report.originalTechnicalReport,'Synthetic report');
});
