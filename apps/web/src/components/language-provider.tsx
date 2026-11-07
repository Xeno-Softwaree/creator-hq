"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, LANGUAGE_KEY, resolveInitialLocale, translate, type Locale } from '../lib/i18n';
import {localeRegistry,supportedLocales} from '../locales';
type LanguageContext={locale:Locale;setLocale:(locale:Locale)=>void;t:(key:string,params?:Record<string,string|number>)=>string};
const Context=createContext<LanguageContext>({locale:DEFAULT_LOCALE,setLocale:()=>{},t:(key,params)=>translate(DEFAULT_LOCALE,key,params)});
export function LanguageProvider({children}:{children:ReactNode}){
 const [locale,setLanguage]=useState<Locale>(DEFAULT_LOCALE);
 useEffect(()=>{
  let saved:unknown=null;try{saved=localStorage.getItem(LANGUAGE_KEY)}catch{/* Browser policy may disable storage. */}
  const languages=navigator.languages?.length?navigator.languages:[navigator.language];
  setLanguage(resolveInitialLocale(saved,languages));
  const listener=(event:StorageEvent)=>{if(event.key===LANGUAGE_KEY)setLanguage(resolveInitialLocale(event.newValue,languages))};
  window.addEventListener('storage',listener);return()=>window.removeEventListener('storage',listener);
 },[]);
 useEffect(()=>{document.documentElement.lang=locale;document.querySelector('meta[name="description"]')?.setAttribute('content',translate(locale,'metadata.description'))},[locale]);
 const setLocale=(next:Locale)=>{setLanguage(next);try{localStorage.setItem(LANGUAGE_KEY,next)}catch{/* Switching still works without persistence. */}};
 return <Context.Provider value={{locale,setLocale,t:(key,params)=>translate(locale,key,params)}}>{children}</Context.Provider>;
}
export const useLanguage=()=>useContext(Context);
export function LanguageSwitcher(){const {locale,setLocale,t}=useLanguage();return <div className="language-switch" role="group" aria-label={t('language.label')}>{supportedLocales.map(value=><button key={value} type="button" lang={value} aria-label={translate(value,'language.nativeName')} aria-pressed={locale===value} onClick={()=>setLocale(value)}>{localeRegistry[value].shortLabel}</button>)}</div>}
