import { NextRequest, NextResponse } from 'next/server'
import { getComposerFromRequest } from '@/lib/composer-middleware'
import {
  addStudioCreditTransaction,
  canCreateStudioMusicWithCredits,
  getFreeLyricUsage,
  getFreeMusicUsage,
  getProjectForComposer,
  getStudioAccess,
  getStudioCreditUsage,
} from '@/lib/studio'
import { supabaseAdmin } from '@/lib/supabase'
import { formatMusicTitle } from '@/lib/normalize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const STUDIO_TITLE_MAX_LENGTH = 30

const actions: Record<string, string> = {
  improve_chorus: 'melhore principalmente o refrão, deixando mais forte e memorável',
  sticky: 'deixe o refrão mais chiclete, sem ficar infantil',
  sadder: 'deixe a letra mais sofrida e emocional',
  modern: 'deixe a linguagem mais moderna e atual',
  romantic: 'deixe a letra mais romântica e sensível',
  commercial: 'deixe a música mais comercial e pronta para rádio/streaming',
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

function normalizeStyleName(style?: string | null) {
  return String(style || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function getStyleSpecificLyricInstruction(style?: string | null) {
  const normalized = normalizeStyleName(style)
  const isModaDeViola = (
    normalized.includes('moda de viola') ||
    normalized.includes('modao') ||
    normalized.includes('modao raiz') ||
    normalized.includes('viola caipira') ||
    normalized.includes('sertanejo raiz') ||
    normalized.includes('caipira raiz') ||
    normalized.includes('tiao carreiro') ||
    normalized.includes('pardinho')
  )

  if (!isModaDeViola) return ''

  return `
Instrução obrigatória para MODA DE VIOLA / SERTANEJO RAIZ:
- tratar como música caipira raiz/tradicional, NÃO como sertanejo moderno;
- linguagem de roça/interior, narrativa, simples, madura e respeitosa;
- referência estética: dupla caipira clássica, viola caipira, ponteados, pagode de viola/modão;
- evitar pegada universitária, agronejo, sofrência pop, arrocha moderno, batida eletrônica e refrão chiclete pop;
- evitar gírias urbanas modernas e imagens de balada/caminhonete/luxo;
- criar versos com cara de moda antiga, história bem contada e refrão natural.
`.trim()
  }

function buildProjectDescription(body: any, fallbackDescription?: string | null) {
  const idea = typeof body.idea === 'string' ? body.idea.trim() : ''
  const voiceGender = typeof body.voiceGender === 'string' ? body.voiceGender.trim() : ''
  const voiceTone = typeof body.voiceTone === 'string' ? body.voiceTone.trim() : ''
  const voiceNotes = [voiceGender, voiceTone]
    .filter((value) => value && value !== 'Deixar a IA escolher')

  if (!idea && voiceNotes.length === 0) return fallbackDescription || null
  if (voiceNotes.length === 0) return idea || fallbackDescription || null

  return [
    idea || fallbackDescription || '',
    '',
    `Preferência de voz: ${voiceNotes.join(', ')}`,
  ].filter(Boolean).join('\n')
}

function buildPrompt(input: any, existingLyric?: string) {
  const avoid = [
    input.avoidCliches && 'evitar clichês',
    input.avoidChildishRhymes && 'evitar rimas infantis',
    input.avoidRepeatedWords && 'evitar palavras repetidas',
    input.stickyChorus && 'refrão mais chiclete',
    input.popularLanguage && 'linguagem mais popular',
    input.sophisticatedLanguage && 'linguagem mais sofisticada',
  ].filter(Boolean).join(', ')

  const actionInstruction = input.action ? actions[input.action] || input.action : ''

  return `
Você é um compositor profissional brasileiro. Escreva letras cantáveis, naturais e emocionais, sem parecer IA.

Regras:
- foco em música brasileira
- frases naturais, sem clichês baratos
- evitar rimas forçadas e palavras colocadas só para rimar
- criar storytelling e imagens emocionais
- refrão memorável, mas sem repetir a mesma frase em excesso
- respeitar estrutura pedida
- separar por partes como [A], [B], [Refrão], [C]
- manter a letra objetiva, ideal para uma música de 2 a 4 minutos
- repetir o refrão no máximo uma vez
- não repetir a música inteira no final
- se criar [Final], fazer encerramento curto, sem recomeçar a primeira parte
- escrever linhas cantáveis, com respiração natural para o cantor
- evitar frases longas demais e excesso de sílabas na mesma linha
- preferir linhas curtas ou médias, fáceis de cantar sem atropelar palavras
- colocar emoção concreta em cenas, detalhes e imagens, não só frases genéricas
- variar melodicamente a intenção das partes: verso conta história, pré-refrão cresce, refrão resolve a emoção

Dados:
Nome: ${input.title || 'Sem título'}
Estilo: ${input.style || 'Livre'}
Clima: ${input.mood || 'Livre'}
Estrutura: ${input.structure || 'Livre'}
Quantidade: ${input.lineCount || 'média'}
Diretrizes: ${avoid || 'nenhuma'}
Tema: ${input.idea || 'não informado'}
${getStyleSpecificLyricInstruction(input.style)}
${actionInstruction ? `Pedido de edição: ${actionInstruction}` : ''}
${existingLyric ? `\nLetra atual para reescrever/melhorar:\n${existingLyric}` : ''}

Responda somente com a letra completa, organizada por partes.
`.trim()
}

async function generateLyricWithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('A geração de letras não está configurada no servidor.')

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
          content: 'Você é um compositor profissional especializado em música brasileira popular, rádio e streaming.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('[Studio IA] Erro OpenAI letra:', text)
    throw new Error('Não consegui gerar a letra agora. Tente novamente.')
  }

  const data = await response.json()
  const lyric = data.choices?.[0]?.message?.content?.trim()
  if (!lyric) throw new Error('A IA não retornou uma letra válida')
  return lyric
}

export async function POST(request: NextRequest) {
  try {
    const composer = getComposerFromRequest(request)
    if (!composer) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { hasAccess, limits } = await getStudioAccess(composer.composerId)
    const usage = await getStudioCreditUsage(composer.composerId, limits)
    const hasPaidCredits = canCreateStudioMusicWithCredits(usage)

    if (!hasAccess && !hasPaidCredits) {
      const freeMusicUsage = await getFreeMusicUsage(composer.composerId)
      if (freeMusicUsage.remaining <= 0) {
        return NextResponse.json(
          {
            error: 'Você já usou sua música grátis. Para continuar criando, escolha um plano ou compre uma recarga avulsa.',
          },
          { status: 403 }
        )
      }
    }

    if (!hasAccess && !hasPaidCredits) {
      const freeUsage = await getFreeLyricUsage(composer.composerId)
      if (freeUsage.used >= freeUsage.limit) {
        return NextResponse.json(
          {
            error: `Você atingiu o limite grátis de ${freeUsage.limit} letras por mês. Assine o DCC Studio IA para letras ilimitadas.`,
            freeUsage,
          },
          { status: 429 }
        )
      }
    }

    const body = await request.json()
    const project = await getProjectForComposer(body.projectId, composer.composerId)
    if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const existingLyric = typeof body.existingLyric === 'string' ? body.existingLyric : ''
    const prompt = buildPrompt(body, existingLyric)
    const lyric = await generateLyricWithOpenAI(prompt)

    await supabaseAdmin
      .from('studio_lyrics')
      .update({ is_current: false, updated_at: new Date().toISOString() })
      .eq('project_id', project.id)
      .eq('composer_id', composer.composerId)

    const { data, error } = await supabaseAdmin
      .from('studio_lyrics')
      .insert({
        project_id: project.id,
        composer_id: composer.composerId,
        content: lyric,
        prompt: body,
        is_current: true,
      })
      .select('*')
      .single()

    if (error) throw error

    if (!hasAccess && !hasPaidCredits) {
      await addStudioCreditTransaction({
        composerId: composer.composerId,
        projectId: project.id,
        action: 'lyric_generation_free',
        amount: 0,
        description: 'Geração grátis de letra no DCC Studio IA',
        metadata: {
          ip: getClientIp(request),
          userAgent: request.headers.get('user-agent') || null,
          composerEmail: composer.email || null,
          composerName: composer.name || null,
        },
      })
    }

    await supabaseAdmin
      .from('studio_projects')
      .update({
        title: typeof body.title === 'string' ? formatMusicTitle(body.title.trim().slice(0, STUDIO_TITLE_MAX_LENGTH) || project.title) : project.title,
        style: body.style || project.style,
        mood: body.mood || project.mood,
        structure: body.structure || project.structure,
        line_count: body.lineCount || project.line_count,
        description: buildProjectDescription(body, project.description),
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id)

    return NextResponse.json({ lyric: data.content })
  } catch (error: any) {
    console.error('[Studio IA] Erro gerar letra:', error)
    return NextResponse.json({ error: error.message || 'Erro ao gerar letra' }, { status: 500 })
  }
}
