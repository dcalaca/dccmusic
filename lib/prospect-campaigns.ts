import { supabaseAdmin as db } from './supabase'
import { buildDccEmailHtml, dccEmailButton, escapeEmailHtml as esc } from './dcc-email-template'
import { getEmailOptOutUrl } from './email-opt-outs'
import { personalizeProspect } from './prospect-import'
export async function prospectStats(id: string) {
  const { data, error } = await db.rpc('prospect_delivery_stats', { cid: id })
  if (error) throw error
  return { pending:0, processing:0, sent:0, failed:0, skipped:0, uncertain:0, ...data } as Record<string,number>
}
export async function processProspectCampaign(id: string) {
  if (!process.env.RESEND_API_KEY) throw new Error('Resend não configurado.')
  const { data: campaign, error } = await db.from('prospect_campaigns').select('*').eq('id',id).single()
  if (error) throw error
  // Unknown outcomes are never retried automatically: provider idempotency expires after 24h.
  const stale = await db.from('prospect_deliveries').update({status:'uncertain',error:'Envio interrompido; verificar no provedor antes de qualquer novo envio.'}).eq('campaign_id',id).eq('status','processing').lt('claimed_at',new Date(Date.now()-600000).toISOString())
  if (stale.error) throw stale.error
  const { data: rows, error: claimError } = await db.rpc('claim_prospect_batch',{cid:id})
  if (claimError) throw claimError
  for (const row of rows || []) {
    let outcome: Record<string, unknown>
    try {
      const { data: optOut, error: optError } = await db.from('admin_email_opt_outs').select('email').eq('email',row.email).limit(1)
      if (optError) throw optError
      if (optOut?.length) outcome = {status:'skipped',error:'Descadastrado'}
      else {
        const subject = personalizeProspect(campaign.subject,row.name)
        const body = personalizeProspect(campaign.body,row.name)
        const unsubscribe = getEmailOptOutUrl({email:row.email})
        const html = buildDccEmailHtml({subject,title:subject,contentHtml:`<p>${esc(body).replace(/\n/g,'<br>')}</p>${dccEmailButton('Criar minha primeira música grátis','https://www.dccmusic.online/studio-ia')}<p style="font-size:12px">Uma apresentação da DCC Music. <a href="${esc(unsubscribe)}">Não quero receber estes e-mails</a></p>`})
        const response = await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`prospect-${id}-${row.contact_id}`},body:JSON.stringify({from:'DCC Music <suporte@email.dccmusic.online>',reply_to:'suporte@dccmusic.online',to:[row.email],subject,html,text:`${body}\n\nCrie sua música: https://www.dccmusic.online/studio-ia\nDescadastrar: ${unsubscribe}`,tags:[{name:'campaign_id',value:id},{name:'contact_id',value:row.contact_id}]})})
        const payload = await response.json().catch(()=>({}))
        outcome = response.ok ? {status:'sent',provider_id:payload.id} : {status:response.status >= 500 ? 'uncertain' : 'failed',error:String(payload.message || `HTTP ${response.status}`).slice(0,500)}
      }
    } catch (e: any) { outcome = {status:'uncertain',error:String(e.message).slice(0,500)} }
    const saved = await db.from('prospect_deliveries').update(outcome).eq('id',row.id).eq('status','processing')
    if (saved.error) throw saved.error
    await new Promise(resolve=>setTimeout(resolve,600))
  }
  const stats = await prospectStats(id)
  if (!stats.pending && !stats.processing) {
    const saved = await db.from('prospect_campaigns').update({status:'sent'}).eq('id',id).eq('status','sending')
    if (saved.error) throw saved.error
  }
  return stats
}
