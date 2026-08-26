import { NextRequest, NextResponse } from 'next/server'
import { isValidStudioCallback } from '@/lib/studio'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (!isValidStudioCallback(request)) {
    return NextResponse.json({ error: 'Callback não autorizado.' }, { status: 401 })
  }

  // O fluxo administrativo consulta o resultado pelo taskId. O callback existe para
  // atender ao contrato obrigatório da Suno e confirma o recebimento imediatamente.
  return NextResponse.json({ received: true })
}
