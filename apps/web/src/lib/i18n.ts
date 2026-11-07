import { localeRegistry, supportedLocales, isLocale, type Locale } from '../locales';
export type { Locale } from '../locales';
export type DeploymentMode = 'personal' | 'public';
export const DEPLOYMENT_MODE: DeploymentMode = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'public' ? 'public' : 'personal';
export const deploymentDefault=(mode:DeploymentMode):Locale=>mode==='public'?'en-US':'tr-TR';
export const DEFAULT_LOCALE = deploymentDefault(DEPLOYMENT_MODE);
// Keep this key unchanged: existing owner preferences take precedence over deployment defaults.
export const LANGUAGE_KEY = 'creator-hq.locale';
export function resolveLocale(value:unknown,fallback:Locale=DEFAULT_LOCALE):Locale {return isLocale(value)?value:fallback;}
export function detectBrowserLocale(languages:readonly string[]):Locale {
 for(const language of languages){const base=language.toLowerCase().split('-')[0];const match=supportedLocales.find(locale=>localeRegistry[locale].browserLanguage===base);if(match)return match;}
 return 'en-US';
}
export function resolveInitialLocale(saved:unknown,languages:readonly string[],mode:DeploymentMode=DEPLOYMENT_MODE):Locale {
 if(isLocale(saved))return saved;
 return mode==='public'?detectBrowserLocale(languages):deploymentDefault(mode);
}
export type Catalogs=Partial<Record<Locale,Record<string,string>>>;
export function translate(locale:Locale,key:string,params:Record<string,string|number>={},catalogs:Catalogs=Object.fromEntries(supportedLocales.map(code=>[code,localeRegistry[code].messages])),mode:DeploymentMode=DEPLOYMENT_MODE) {
 const lookup=(code:Locale,name:string)=>{const dictionary=catalogs[code];return dictionary&&Object.prototype.hasOwnProperty.call(dictionary,name)&&typeof dictionary[name]==='string'?dictionary[name]:undefined;};
 const fallback=deploymentDefault(mode);
 const value=lookup(locale,key)??lookup(fallback,key)??lookup('en-US',key)??lookup(fallback,'common.translationUnavailable')??localeRegistry[fallback].messages['common.translationUnavailable'];
 return value.replace(/\{(\w+)\}/g,(match,name:string)=>params[name]===undefined?match:String(params[name]));
}
export function formatDate(value:string,locale:Locale){const date=new Date(value);return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(date);}
export function formatNumber(value:number,locale:Locale){return new Intl.NumberFormat(locale).format(value);}
export function localizedActivity(message:string,t:(key:string,params?:Record<string,string|number>)=>string){
 if(message.startsWith('Task created: '))return t('activity.taskCreated',{title:message.slice('Task created: '.length)});
 if(message==='SIMULATED: prepared a sample concept for human review. No process executed.')return t('activity.simulatedConcept');
 return message; // Unknown/user-authored records remain verbatim.
}
