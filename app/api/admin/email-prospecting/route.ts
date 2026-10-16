import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin as db } from '@/lib/supabase'
import { processProspectCampaign, prospectStats } from '@/lib/prospect-campaigns'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
export async function GET(req: NextRequest) {
 if (!await getServerSession(authOptions)) return NextResponse.json({error:'Não autorizado'},{status:401})
 try {
  const id=req.nextUrl.searchParams.get('id')
  if(id) return NextResponse.json({stats:await prospectStats(id)})
  const {data,error}=await db.from('prospect_campaigns').select('*').order('created_at',{ascending:false}).limit(100)
  if(error) throw error
  return NextResponse.json({campaigns:await Promise.all((data||[]).map(async c=>({...c,stats:await prospectStats(c.id)})))})
 } catch(e:any) {return NextResponse.json({error:e.message},{status:500})}
}
export async function POST(req:NextRequest) {
 if (!await getServerSession(authOptions)) return NextResponse.json({error:'Não autorizado'},{status:401})
 try {
  const b=await req.json(); const id=String(b.id||'')
  if(b.action==='create') {
   if(!String(b.name||'').trim() || !String(b.subject||'').trim() || !String(b.body||'').trim() || b.body.length>30000 || b.subject.length>200) throw new Error('Informe nome, assunto (até 200 caracteres) e mensagem (até 30.000).')
   const {data,error}=await db.from('prospect_campaigns').insert({name:String(b.name).slice(0,200),subject:b.subject,body:b.body}).select().single()
   if(error) throw error
   return NextResponse.json({campaign:data})
  }
  if(!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Campanha inválida')
  if(b.action==='import') {
   if(!Array.isArray(b.contacts)||b.contacts.length>300||b.contacts.some((c:any)=>!c||typeof c.email!=='string'||! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.email)||c.email.length>254||typeof c.name!=='string'||c.name.length>200)) throw new Error('Lote inválido')
   const {error}=await db.rpc('import_prospect_chunk',{cid:id,contacts:b.contacts}); if(error) throw error
  } else if(b.action==='finalize') {
   const {error}=await db.from('prospect_campaigns').update({import_complete:true}).eq('id',id).eq('status','draft');if(error)throw error
  } else if(b.action==='start'||b.action==='pause') {
   const {data,error}=await db.from('prospect_campaigns').update({status:b.action==='start'?'sending':'paused'}).eq('id',id).eq('import_complete',true).in('status',b.action==='start'?['draft','paused']:['sending']).select('id')
   if(error) throw error
   if(!data?.length) throw new Error('Campanha não pode ser alterada neste estado')
  } else if(b.action==='process') return NextResponse.json({stats:await processProspectCampaign(id)})
  else throw new Error('Ação inválida')
  return NextResponse.json({success:true})
 }catch(e:any){return NextResponse.json({error:e.message},{status:400})}
}
