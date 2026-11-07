"use client";
import {useEffect,useRef,useState} from 'react';
import {useLanguage} from './language-provider';
import {Button} from './ui/button';
import {executionSourceKey,executionStatusKey,executionStatuses} from '../lib/execution';
type Agent={id:string;name:string;studio:string;enabled:boolean};
type Task={id:string;title:string;description:string;agentId:string;studio:string};
type Draft={taskId:string|null;title:string;description:string;agentId:string;studio:string};
type Preview={source:'preview';enabled:false;status:string;digest:string;contract:{instructions:string;permissions:Record<string,unknown>};approval:{valid:false}};
const API=process.env.NEXT_PUBLIC_API_URL??'http://127.0.0.1:4100';
export function ExecutionPreview({agents,tasks}:{agents:Agent[];tasks:Task[]}){
 const {t}=useLanguage();const [draft,setDraft]=useState<Draft>({taskId:null,title:'',description:'',agentId:'writer',studio:'Niko'});
 const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);const revision=useRef(0);
 useEffect(()=>{revision.current++;setPreview(null);setBusy(false)},[agents,tasks]);
 function edit(next:Draft){revision.current++;setDraft(next);setPreview(null);setError(false);setBusy(false);}
 async function inspect(){const current=++revision.current;setBusy(true);setError(false);setPreview(null);
  try{const res=await fetch(API+'/execution/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft),signal:AbortSignal.timeout(15000)});if(!res.ok)throw Error();const body:Preview=await res.json();if(body.source!=='preview'||body.enabled!==false||body.approval.valid!==false)throw Error();if(current===revision.current)setPreview(body);
  }catch{if(current===revision.current)setError(true)}finally{if(current===revision.current)setBusy(false)}
 }
 return <section className="panel execution-preview"><h2>{t("execution.title")}</h2><p className="subnote">{t("execution.boundary")}</p>
 <form onSubmit={e=>{e.preventDefault();void inspect()}}>
 <label>{t("execution.existingTask")}<select value={draft.taskId??''} onChange={e=>{const task=tasks.find(x=>x.id===e.target.value);edit(task?{taskId:task.id,title:task.title,description:task.description,agentId:task.agentId,studio:task.studio}:{...draft,taskId:null})}}><option value="">{t("execution.draft")}</option>{tasks.map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
 <label>{t("task.title")}<input value={draft.title} required maxLength={160} onChange={e=>edit({...draft,taskId:null,title:e.target.value})}/></label>
 <label>{t("task.description")}<textarea maxLength={5000} value={draft.description} onChange={e=>edit({...draft,taskId:null,description:e.target.value})}/></label>
 <div className="form-grid"><label>{t("task.studio")}<select value={draft.studio} onChange={e=>edit({...draft,taskId:null,studio:e.target.value,agentId:e.target.value==='Niko'?'writer':e.target.value==='Son Yedek'?'designer':'director'})}>{['HQ','Niko','Son Yedek'].map(studio=><option key={studio} value={studio}>{studio==='HQ'?t("studio.hq"):studio}</option>)}</select></label>
 <label>{t("task.agent")}<select value={draft.agentId} onChange={e=>edit({...draft,taskId:null,agentId:e.target.value})}>{agents.filter(a=>a.id!=='ceo'&&a.enabled&&(a.studio==='HQ'||a.studio===draft.studio)).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div>
 <p className="subnote">{t("execution.permissions")}</p><Button disabled={busy||!draft.title.trim()}>{t(busy?"execution.loading":"execution.inspect")}</Button>
 </form>{error&&<p role="alert">{t("execution.error")}</p>}
 {preview&&<div className="execution-contract" role="status"><span className="tag gold">{t(executionSourceKey(preview.source))}</span><h3>{t(executionStatusKey(preview.status))}</h3><p>{t("execution.noApproval")}</p><p>{t("execution.changeInvalidates")}</p><code>{preview.digest}</code><details><summary>{t("execution.instructions")}</summary><pre>{preview.contract.instructions}</pre></details><Button disabled>{t("execution.approvalDisabled")}</Button></div>}
 <details><summary>{t("execution.statusLegend")}</summary><ul>{executionStatuses.map(status=><li key={status}>{t(executionStatusKey(status))}</li>)}</ul></details>
 </section>;
}
