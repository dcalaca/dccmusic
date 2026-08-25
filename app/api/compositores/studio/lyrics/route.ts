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

function shortenGeneratedTitle(value: string) {
  const clean = String(value || '')
    .replace(/^[-–—"'“”‘’]+|[-–—"'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!clean) return 'Nova Música'
  if (clean.length <= STUDIO_TITLE_MAX_LENGTH) return formatMusicTitle(clean)

  const preview = clean.slice(0, STUDIO_TITLE_MAX_LENGTH + 1)
  const lastSpace = preview.lastIndexOf(' ')
  const shortened = lastSpace >= 12
    ? preview.slice(0, lastSpace)
    : clean.slice(0, STUDIO_TITLE_MAX_LENGTH)

  return formatMusicTitle(shortened.trim())
}

function deriveTitleFromLyric(lyric: string) {
  const lines = String(lyric || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const sectionLine = /^\[[^\]]+\]$/
  const chorusLine = /^\[(refr[aã]o|coro|estribillo|chorus)\]$/i
  const chorusIndex = lines.findIndex((line) => chorusLine.test(line))
  const candidate = chorusIndex >= 0
    ? lines.slice(chorusIndex + 1).find((line) => !sectionLine.test(line))
    : lines.find((line) => !sectionLine.test(line))

  return shortenGeneratedTitle(candidate || 'Nova Música')
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

  const language = typeof body.songLanguage === 'string' && body.songLanguage.trim()
    ? body.songLanguage.trim()
    : 'Português (Brasil)'

  return [
    idea || fallbackDescription || '',
    '',
    `Idioma da música: ${language}`,
    voiceNotes.length > 0 ? `Preferência de voz: ${voiceNotes.join(', ')}` : '',
  ].filter(Boolean).join('\n')
}

function normalizeLanguage(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
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
  const selectedLanguage = normalizeLanguage(input.songLanguage)
  const mexicanSpanish = selectedLanguage.includes('mexico')
  const colombianSpanish = selectedLanguage.includes('colombia')
  const paraguayanSpanish = selectedLanguage.includes('paraguay')
  const europeanPortuguese = selectedLanguage.includes('portugal')
  const spanishLanguage = mexicanSpanish || colombianSpanish || paraguayanSpanish || selectedLanguage.includes('espa')
  const culturalInstruction = mexicanSpanish
    ? `
Idioma e identidade cultural obrigatórios:
- escrever toda a letra em espanhol natural do México;
- usar vocabulário, construções e fraseado naturais para mexicanos, sem caricaturar o sotaque nem forçar gírias;
- não usar português e não fazer tradução literal do português;
- respeitar o gênero escolhido e, quando for regional mexicano, corrido, corridos tumbados, banda, norteño, sierreño, mariachi, ranchera ou cumbia mexicana, refletir de verdade a identidade musical do México;
- em corridos, priorizar narrativa e imagens concretas; em ranchera/mariachi, priorizar interpretação emocional; em banda/norteño/sierreño, manter fraseado compatível com o gênero;
- evitar regionalismos marcadamente colombianos, paraguaios, argentinos ou espanhóis quando não forem pedidos.`
    : colombianSpanish
      ? `
Idioma e identidade cultural obrigatórios:
- escrever toda a letra em espanhol natural da Colômbia;
- usar vocabulário e construções compreensíveis para colombianos, sem caricaturar o sotaque;
- não usar português brasileiro e não fazer tradução literal;
- respeitar o gênero escolhido e, quando for vallenato, cumbia, salsa ou música popular colombiana, refletir a identidade musical da Colômbia;
- evitar regionalismos de outros países quando não forem pedidos.`
      : paraguayanSpanish || spanishLanguage
        ? `
Idioma e identidade cultural obrigatórios:
- escrever toda a letra em espanhol natural do Paraguai;
- usar vocabulário, ritmo de fala e construções compreensíveis para paraguaios;
- não usar português brasileiro e não usar espanhol artificial traduzido literalmente;
- respeitar o gênero escolhido e, quando for guarania, polca ou cumbia paraguaia, refletir a identidade musical do Paraguai;
- não inserir palavras em guarani, a menos que o usuário peça explicitamente.`
        : europeanPortuguese
          ? `
Idioma e identidade cultural obrigatórios:
- escrever toda a letra em português europeu natural, próprio de Portugal;
- usar vocabulário, construções, colocação pronominal e fraseado naturais em Portugal, sem converter automaticamente para português do Brasil;
- não usar brasileirismos evidentes quando houver uma forma corrente em Portugal;
- respeitar o género escolhido e, quando for fado, música popular portuguesa, pimba, pop português, rock português ou hip-hop tuga, refletir a identidade musical portuguesa sem caricatura;
- manter a letra cantável e natural para um intérprete português.`
          : `
Idioma e identidade cultural obrigatórios:
- escrever toda a letra em português brasileiro natural;
- usar fraseado, vocabulário e pronúncia adequados ao Brasil.`

  return `
Você é um compositor profissional especializado no mercado musical do país escolhido pelo usuário. Escreva letras cantáveis, naturais e emocionais, sem parecer IA.

Regras:
- foco na cultura musical e no sotaque do país/idioma selecionado
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
Idioma selecionado: ${input.songLanguage || 'Português (Brasil)'}
${culturalInstruction}
${getStyleSpecificLyricInstruction(input.style)}
${actionInstruction ? `Pedido de edição: ${actionInstruction}` : ''}
${existingLyric ? `\nLetra atual para reescrever/melhorar:\n${existingLyric}` : ''}

Responda somente com a letra completa, organizada por partes.
`.trim()
}

function getSystemComposerInstruction(songLanguage?: string) {
  const language = normalizeLanguage(songLanguage)
  if (language.includes('mexico')) {
    return 'Eres un compositor profesional mexicano. Escribes canciones naturales en español de México, con identidad local real, listas para radio y streaming, respetando con precisión el género seleccionado.'
  }
  if (language.includes('colombia')) {
    return 'Eres un compositor profesional colombiano. Escribes canciones naturales en español colombiano, con identidad local, listas para radio y streaming.'
  }
  if (language.includes('paraguay') || language.includes('espa')) {
    return 'Eres un compositor profesional paraguayo. Escribes canciones naturales en español paraguayo, con identidad local, listas para radio y streaming.'
  }
  if (language.includes('portugal')) {
    return 'És um compositor profissional de Portugal. Escreves canções naturais em português europeu, com identidade musical portuguesa e linguagem própria de Portugal, prontas para rádio e streaming.'
  }
  return 'Você é um compositor profissional especializado em música brasileira popular, rádio e streaming.'
}

async function generateLyricWithOpenAI(prompt: string, songLanguage?: string) {
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
          content: getSystemComposerInstruction(songLanguage),
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

function inferProjectLanguage(projectDescription: string) {
  const normalized = normalizeLanguage(projectDescription)
  if (normalized.includes('mexico')) return 'Español (México)'
  if (normalized.includes('colombia')) return 'Español (Colombia)'
  if (normalized.includes('paraguay')) return 'Español (Paraguay)'
  if (normalized.includes('portugal')) return 'Português (Portugal)'
  if (normalized.includes('idioma da musica: espa')) return 'Español (Paraguay)'
  return 'Português (Brasil)'
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

    const projectDescription = String(project.description || '')
    const inferredLanguage = inferProjectLanguage(projectDescription)
    const input = {
      ...body,
      songLanguage: String(body.songLanguage || inferredLanguage),
    }
    const existingLyric = typeof body.existingLyric === 'string' ? body.existingLyric : ''
    const prompt = buildPrompt(input, existingLyric)
    const lyric = await generateLyricWithOpenAI(prompt, input.songLanguage)

    const incomingTitle = typeof body.title === 'string' ? body.title.trim() : ''
    const shouldGenerateTitle = !incomingTitle || /^nova m[uú]sica$/i.test(incomingTitle)
    const finalTitle = shouldGenerateTitle
      ? deriveTitleFromLyric(lyric)
      : formatMusicTitle(incomingTitle.slice(0, STUDIO_TITLE_MAX_LENGTH))

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
        prompt: input,
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
        title: finalTitle,
        style: body.style || project.style,
        mood: body.mood || project.mood,
        structure: body.structure || project.structure,
        line_count: body.lineCount || project.line_count,
        description: buildProjectDescription(body, project.description),
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id)

    return NextResponse.json({ lyric: data.content, title: finalTitle })
  } catch (error: any) {
    console.error('[Studio IA] Erro gerar letra:', error)
    return NextResponse.json({ error: error.message || 'Erro ao gerar letra' }, { status: 500 })
  }
}
