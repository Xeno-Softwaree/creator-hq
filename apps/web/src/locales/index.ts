import tr from './tr-TR.json';
import en from './en-US.json';
// To add a language, add its dictionary and one registry entry. Consumers are data-driven.
export const localeRegistry = {
 'tr-TR': {messages:tr,browserLanguage:'tr',shortLabel:'TR'},
 'en-US': {messages:en,browserLanguage:'en',shortLabel:'EN'}
} as const;
export type Locale = keyof typeof localeRegistry;
export const supportedLocales = Object.keys(localeRegistry) as Locale[];
export const isLocale=(value:unknown):value is Locale=>typeof value==='string'&&Object.prototype.hasOwnProperty.call(localeRegistry,value);
