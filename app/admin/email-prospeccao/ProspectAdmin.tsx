'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DEFAULT_BODY, DEFAULT_SUBJECT, parseProspectRows, personalizeProspect, Prospect } from '@/lib/prospect-import'
import { buildDccEmailHtml, dccEmailButton, escapeEmailHtml } from '@/lib/dcc-email-template'
async function api(body?:unknown) {
 const res=await fetch('/api/admin/email-prospecting',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'})
 const data=await res.json(); if(!res.ok) throw new Error(data.error||'Erro na operação'); return data
}
function Progress({value,label}:{value:number;label:string}) {return <div className="my-3"><p className="text-sm mb-2">{label} · {Math.round(value)}%</p><progress aria-label={label} value={value} max={100} className="w-full h-3 accent-purple-500" /></div>}
export default function ProspectAdmin() {
 const [name,setName]=useState('Apresentação DCC Music'),[subject,setSubject]=useState(DEFAULT_SUBJECT),[body,setBody]=useState(DEFAULT_BODY)
 const [contacts,setContacts]=useState<Prospect[]>([]),[campaigns,setCampaigns]=useState<any[]>([]),[report,setReport]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[phase,setPhase]=useState(''),[draftId,setDraftId]=useState<string|null>(null)
 const reload=async()=>{const d=await api();setCampaigns(d.campaigns)}
 useEffect(()=>{let active=true; let timer:ReturnType<typeof setTimeout>; async function tick(){try{const d=await api();if(!active)return;setCampaigns(d.campaigns);for(const c of d.campaigns.filter((c:any)=>c.status==='sending')){if(!active)break;await api({id:c.id,action:'process'})}}catch(e:any){if(active)setError(e.message)}if(active)timer=setTimeout(tick,3000)}tick();return()=>{active=false;clearTimeout(timer)}},[])
 async function readFile(file:File) {
  setBusy(true);setError('');setProgress(0);setPhase('Lendo planilha');setContacts([]);setDraftId(null)
  try {
   if(file.size>25*1024*1024) throw new Error('Use arquivos de até 25 MB. Divida arquivos maiores.')
   const buffer=await new Promise<ArrayBuffer>((resolve,reject)=>{const r=new FileReader();r.onprogress=e=>{if(e.lengthComputable)setProgress(e.loaded/e.total*100)};r.onload=()=>resolve(r.result as ArrayBuffer);r.onerror=()=>reject(new Error('Falha ao ler arquivo'));r.readAsArrayBuffer(file)})
   const XLSX=await import('xlsx');const book=XLSX.read(buffer,{type:'array'});
   const all:Prospect[]=[],seen=new Set<string>();let invalid=0,duplicates=0;const detected:string[]=[]
   for(const sheet of book.SheetNames){
    const rows=XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheet],{header:1,defval:''})
    let parsed;try{parsed=parseProspectRows(rows)}catch{continue}
    invalid+=parsed.invalid;duplicates+=parsed.duplicates;detected.push(`${sheet}: email na coluna ${parsed.emailColumn}${parsed.nameColumn?`, nome na ${parsed.nameColumn}`:''}`)
    for(const c of parsed.contacts){if(seen.has(c.email)){duplicates++;continue}seen.add(c.email);all.push(c)}
   }
   if(!all.length) throw new Error('Nenhum email válido encontrado na planilha.')
   setContacts(all);setReport(`${all.length} contatos válidos · ${duplicates} repetidos · ${invalid} inválidos. ${detected.join(' / ')}`);setProgress(100);setPhase('Leitura concluída')
  }catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function save() {
  setBusy(true);setError('');setProgress(0);setPhase('Importando contatos')
  try{
   let id=draftId
   if(!id){const d=await api({action:'create',name,subject,body});id=d.campaign.id;setDraftId(id)}
   for(let i=0;i<contacts.length;i+=300){await api({action:'import',id,contacts:contacts.slice(i,i+300)});setProgress(Math.min(100,(i+300)/contacts.length*100))}
   await api({action:'finalize',id});setPhase('Importação concluída — campanha salva');await reload()
  }catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 async function action(id:string,action:string){setError('');try{await api({id,action});if(action==='start')await api({id,action:'process'});await reload()}catch(e:any){setError(e.message)}}
 const preview=buildDccEmailHtml({subject:personalizeProspect(subject,'Marina'),title:personalizeProspect(subject,'Marina'),contentHtml:`<p>${escapeEmailHtml(personalizeProspect(body,'Marina')).replace(/\n/g,'<br>')}</p>${dccEmailButton('Criar minha primeira música grátis','https://www.dccmusic.online/studio-ia')}`})
 const input='w-full rounded-xl border border-gray-700 bg-black p-3 mt-2'
 return <main className="max-w-6xl mx-auto px-4 py-8 text-white"><Link href="/admin" className="text-purple-300">← Voltar ao admin</Link><h1 className="text-3xl font-bold mt-6">Prospecção por email</h1><p className="text-gray-400 mt-2">Apresente a DCC Music a novos contatos. Importe XLSX ou CSV, revise e inicie a campanha.</p>
 {error&&<p role="alert" className="bg-red-950 border border-red-700 p-4 my-4 rounded-xl">{error}</p>}
 <div className="grid lg:grid-cols-2 gap-6 mt-6"><section className="bg-gray-950 border border-gray-800 rounded-2xl p-5 space-y-4">
 <label className="block">Planilha<input type="file" accept=".csv,.xlsx" disabled={busy} className={input} onChange={e=>{const f=e.target.files?.[0];if(f)readFile(f)}} /></label><p className="text-xs text-gray-400">Até 25 MB. Procura email, e-mail, mail e variações; também reconhece colunas pelo conteúdo. Lê todas as abas e remove repetições. Nome ausente recebe uma saudação neutra.</p>
 {phase&&<Progress value={progress} label={phase}/>}{report&&<p className="text-sm text-purple-200">{report}</p>}
 {contacts.length>0&&<div className="overflow-auto"><table className="text-xs w-full"><thead><tr><th className="text-left">Nome</th><th className="text-left">Email (amostra)</th></tr></thead><tbody>{contacts.slice(0,5).map(c=><tr key={c.email}><td>{c.name||'—'}</td><td>{c.email}</td></tr>)}</tbody></table></div>}
 <label className="block">Nome da campanha<input disabled={busy||!!draftId} value={name} onChange={e=>setName(e.target.value)} className={input}/></label>
 <label className="block">Assunto<input maxLength={200} disabled={busy||!!draftId} value={subject} onChange={e=>setSubject(e.target.value)} className={input}/></label>
 <label className="block">Mensagem<textarea maxLength={30000} disabled={busy||!!draftId} rows={14} value={body} onChange={e=>setBody(e.target.value)} className={input}/></label><p className="text-sm text-gray-400">Use {'{nome}'} no assunto ou na mensagem. O template, botão e assinatura DCC Music são aplicados automaticamente.</p>
 <button disabled={busy||!contacts.length} onClick={save} className="rounded-xl bg-purple-600 px-5 py-3 font-bold disabled:opacity-40">{busy?'Processando…':draftId?'Concluir / repetir importação sem duplicar':'Salvar campanha e importar'}</button><p className="text-xs text-gray-500">Salvar não envia emails. Para outra mensagem ou lista, selecione um novo arquivo.</p>
 </section><section><h2 className="text-xl font-bold mb-3">Prévia com nome Marina</h2><iframe title="Prévia do email DCC Music" sandbox="" srcDoc={preview} className="w-full h-[850px] rounded-2xl border border-gray-700 bg-white"/></section></div>
 <h2 className="text-2xl font-bold mt-10 mb-4">Campanhas importadas</h2><div className="space-y-4">{campaigns.map(c=>{const s=c.stats||{},total=Object.values(s).reduce((a:number,b)=>a+Number(b),0),done=total-(s.pending||0)-(s.processing||0);return <article key={c.id} className="rounded-2xl border border-gray-700 bg-gray-950 p-5"><h3 className="text-xl font-bold">{c.name}</h3><p className="text-sm text-gray-400">{c.subject} · {c.status==='sent'?'Processamento concluído':c.status==='sending'?'Enviando':c.status==='paused'?'Pausada':'Rascunho'} · ID {c.id}</p><Progress value={total?done/total*100:0} label={`${done} de ${total} processados`}/><p className="text-sm">Aceitos pelo provedor: {s.sent||0} · Falhas: {s.failed||0} · Descadastrados: {s.skipped||0} · A conferir: {s.uncertain||0} · Restantes: {(s.pending||0)+(s.processing||0)}</p><div className="flex gap-3 mt-3">{['draft','paused'].includes(c.status)&&<button disabled={busy||!total||!c.import_complete} onClick={()=>action(c.id,'start')} className="bg-purple-600 rounded-lg px-4 py-2 disabled:opacity-40">{c.status==='paused'?'Retomar envio':'Iniciar envio'}</button>}{c.status==='sending'&&<button onClick={()=>action(c.id,'pause')} className="border border-gray-600 rounded-lg px-4 py-2">Pausar após o lote atual</button>}</div></article>})}</div><p className="text-xs text-gray-500 mt-5">A fila continua no servidor a cada 5 minutos, mesmo com esta página fechada. Envios aceitos não confirmam entrega na caixa de entrada. Contatos descadastrados são ignorados. Envios a conferir não são repetidos automaticamente.</p></main>
}
