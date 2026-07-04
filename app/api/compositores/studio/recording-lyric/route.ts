import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeStyleName(style?: string | null) {
  return String(style || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getStyleSpecificInstruction(style?: string | null) {
  const normalized = normalizeStyleName(style)
  const isModaDeViola = (
    normalized.includes('moda de viola') ||
    normalized.includes('modao') ||
    normalized.includes('viola caipira') ||
    normalized.includes('sertanejo raiz') ||
    normalized.includes('caipira raiz') ||
    normalized.includes('tiao carreiro') ||
    normalized.includes('pardinho')
  )

  if (!isModaDeViola) return ''

  return `
Instrução obrigatória de estilo:
- completar como moda de viola / sertanejo raiz tradicional;
- manter linguagem caipira/interiorana, narrativa e madura;
- evitar sertanejo universitário, agronejo, arrocha moderno, pop sertanejo e batida eletrônica;
- pensar em estética de dupla caipira clássica, viola caipira e modão antigo.
`.trim()
}

function buildCompletionPrompt(input: {
  title: string
  style: string
  lyric: string
  notes: string
}) {
  return `
Você é um compositor profissional brasileiro. O usuário cantou ou escreveu um trecho de uma música.

Sua tarefa:
- completar a música inteira a partir do trecho informado;
- manter a ideia, o jeito simples e a emoção do usuário;
- organizar em partes como [A], [B], [Refrão], [C];
- criar uma letra cantável, natural e comercial;
- usar linhas curtas ou médias, com respiração natural;
- evitar frases compridas demais que façam a IA atropelar palavras;
- manter emoção concreta, com cenas e detalhes, sem ficar genérico;
- evitar repetir a mesma ideia muitas vezes;
- manter a letra objetiva, ideal para uma música de 2 a 4 minutos;
- repetir o refrão no máximo uma vez;
- não repetir a música inteira no final;
- se criar [Final], fazer um encerramento curto, sem recomeçar a primeira parte;
- não explicar nada, responder somente com a letra completa.

Nome da música: ${input.title || 'Sem título'}
Estilo desejado: ${input.style || 'Livre'}
Observação do usuário: ${input.notes || 'Nenhuma'}
${getStyleSpecificInstruction(input.style)}

Trecho cantado ou escrito:
${input.lyric}
`.trim()
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'Completar letra não está configurado no servidor.' }, { status: 500 })
    }

    const body = await request.json()
    const lyric = String(body?.lyric || '').trim()
    if (lyric.length < 10) {
      return NextResponse.json({ error: 'Escreva ou transcreva pelo menos um trecho da música.' }, { status: 400 })
    }

    const prompt = buildCompletionPrompt({
      title: String(body?.title || '').trim().slice(0, 30),
      style: String(body?.style || '').trim().slice(0, 120),
      lyric: lyric.slice(0, 3000),
      notes: String(body?.notes || '').trim().slice(0, 800),
    })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
        temperature: 0.9,
        messages: [
          {
            role: 'system',
            content: 'Você escreve letras brasileiras cantáveis para compositores populares, com linguagem simples e natural.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      console.error('[Studio IA] Erro ao completar letra:', data)
      return NextResponse.json({ error: data?.error?.message || 'Não consegui completar a letra agora.' }, { status: 500 })
    }

    const completedLyric = String(data?.choices?.[0]?.message?.content || '').trim()
    if (!completedLyric) {
      return NextResponse.json({ error: 'A IA não retornou uma letra válida.' }, { status: 500 })
    }

    return NextResponse.json({ lyric: completedLyric })
  } catch (error: any) {
    console.error('[Studio IA] Erro completar letra gravada:', error)
    return NextResponse.json({ error: error.message || 'Erro ao completar letra' }, { status: 500 })
  }
}
