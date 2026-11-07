"use client";
import { useEffect, useState } from 'react';
import { useLanguage } from './language-provider';
import { Button } from './ui/button';
import { formatDate } from '../lib/i18n';
import { summarizeReport, type Report } from '../lib/reports';
import {executionSourceKey} from '../lib/execution';
export type { Report } from '../lib/reports';
export function Reports({reports}:{reports:Report[]}) {
 const {t,locale}=useLanguage();
 return <section className="panel reports"><h2>{t("copy.ceoReports")}</h2><p className="subnote">{t("copy.ceoSummariesUseDeterministicTemplatesLiveCodexOrchestration")}</p>
 {!reports.length?<p className="empty">{t("copy.noReportsYet")}</p>:reports.map(report=><article key={report.id} className="report"><div className="section-head"><span className={'tag '+(report.source==='manual'?'neutral':'gold')}>{t(executionSourceKey(report.source))}</span><small>{formatDate(report.createdAt,locale)}</small></div><dl>{summarizeReport(report,t).map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl><details><summary>{t("copy.viewTechnicalReport")}</summary><h3>{t("copy.originalTechnicalReport")}</h3><code>{report.taskId??report.agentId}</code><pre tabIndex={0}>{report.originalTechnicalReport}</pre></details></article>)}
 </section>
}
export function StudioLanguages({settings,busy,onSave}:{settings:{id:string;contentLanguage:string}[];busy:boolean;onSave:(id:string,value:string)=>Promise<boolean>}) {
 const {t}=useLanguage();const [draft,setDraft]=useState<Record<string,string>>({});const [saved,setSaved]=useState<string|null>(null);
 useEffect(()=>{setDraft(previous=>{const next={...previous};for(const item of settings)if(next[item.id]===undefined)next[item.id]=item.contentLanguage;return next})},[settings]);
 return <section className="panel"><h2>{t("studio.contentLanguages")}</h2><p className="subnote">{t("copy.theseSettingsAreIndependentOfTheDashboardLanguage")}</p>{['Niko','Son Yedek'].map(id=><form key={id} className="studio-language" onSubmit={async event=>{event.preventDefault();if(await onSave(id,draft[id]??settings.find(s=>s.id===id)?.contentLanguage??(id==='Niko'?'en-US':'tr-TR')))setSaved(id)}}><label>{id==='Niko'?'Afterlight Stories / Niko':id} · {t("studio.contentLanguage")}<select aria-label={`${id} · ${t("studio.contentLanguage")}`} value={draft[id]??settings.find(s=>s.id===id)?.contentLanguage??(id==='Niko'?'en-US':'tr-TR')} onChange={e=>{setDraft({...draft,[id]:e.target.value});setSaved(null)}}><option value="en-US">{t("language.english")} (en-US)</option><option value="tr-TR">{t("language.turkish")} (tr-TR)</option></select></label><Button disabled={busy||settings.length===0}>{t("studio.saveLanguage")}</Button>{saved===id&&<span role="status">{t("studio.languageSaved")}</span>}</form>)}</section>
}
