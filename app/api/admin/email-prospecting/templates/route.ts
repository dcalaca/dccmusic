import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin as db } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
 if (!await getServerSession(authOptions)) return NextResponse.json({error:'Não autorizado'},{status:401})
 try {
  const {data,error}=await db.from('templates_campanhas_avulsas')
   .select('id,title,campaign_name,subject,body,description')
   .eq('active',true).order('sort_order',{ascending:true}).limit(20)
  if(error) throw error
  return NextResponse.json({templates:data||[]})
 }catch(e:any){return NextResponse.json({error:'Não foi possível carregar os templates'},{status:500})}
}
