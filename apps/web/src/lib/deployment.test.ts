import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveInitialLocale,detectBrowserLocale,translate,LANGUAGE_KEY} from './i18n';
import {localeRegistry,supportedLocales} from '../locales';
test('personal deployment stays Turkish and preserves saved preference',()=>{
 assert.equal(resolveInitialLocale(null,['en-US'],'personal'),'tr-TR');
 assert.equal(resolveInitialLocale('tr-TR',['en-US'],'public'),'tr-TR');
 assert.equal(resolveInitialLocale('en-US',['tr-TR'],'personal'),'en-US');
 assert.equal(LANGUAGE_KEY,'creator-hq.locale');
});
test('public deployment detects browser language and falls back to English',()=>{
 for(const language of ['tr','tr-TR','tr-CY','TR-tr'])assert.equal(resolveInitialLocale(null,[language],'public'),'tr-TR');
 for(const language of ['en','en-US','en-GB'])assert.equal(resolveInitialLocale(null,[language],'public'),'en-US');
 assert.equal(resolveInitialLocale(null,['fr-FR'],'public'),'en-US');
 assert.equal(resolveInitialLocale('invalid',[],'public'),'en-US');
 assert.equal(detectBrowserLocale(['fr-FR','tr-TR']),'tr-TR');
});
test('translation fallback is deployment-specific, keys and placeholders are stable',()=>{
 const catalogs={'tr-TR':{example:'Türkçe'},'en-US':{example:'English'}};
 assert.equal(translate('tr-TR','example',{},catalogs,'public'),'Türkçe');
 assert.equal(translate('tr-TR','example',{}, {'en-US':{example:'English'}},'public'),'English');
 assert.equal(translate('en-US','example',{}, {'tr-TR':{example:'Türkçe'}},'personal'),'Türkçe');
 assert.equal(translate('en-US','unknown',{}, {},'public'),localeRegistry['en-US'].messages['common.translationUnavailable']);
 const reference=Object.keys(localeRegistry['en-US'].messages).sort();
 for(const locale of supportedLocales){const messages=localeRegistry[locale].messages;assert.deepEqual(Object.keys(messages).sort(),reference);for(const key of reference){assert.match(key,/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9_]*)+$/);assert.deepEqual((messages[key as keyof typeof messages].match(/\{\w+\}/g)??[]).sort(),(localeRegistry['en-US'].messages[key as keyof typeof localeRegistry['en-US']['messages']].match(/\{\w+\}/g)??[]).sort())}}
});
