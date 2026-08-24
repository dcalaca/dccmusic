'use client'

import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { FiActivity, FiCheck, FiChevronDown, FiClock, FiFileText, FiHeadphones, FiLoader, FiMic, FiMusic, FiPlay, FiSliders, FiZap } from 'react-icons/fi'

const customStyle = 'Outro / escrever meu estilo'
const defaultStyles = ['Sertanejo', 'Moda de Viola', 'Sertanejo Raiz', 'Trap', 'Pagode', 'Arrocha', 'Pop', 'Livre', customStyle]
const moods = ['Romântica', 'Sofrência', 'Chiclete', 'Engraçada', 'Reflexiva', 'Balada', 'Triste', 'Motivacional']
const voiceGenders = ['Deixar a IA escolher', 'Voz masculina', 'Voz feminina', 'Dueto masculino e feminino']
const voiceTones = ['Deixar a IA escolher', 'Voz grave', 'Voz média', 'Voz aguda', 'Voz rouca', 'Voz suave', 'Voz forte']
const themes = [
  { label: 'Amor', idea: 'Uma história de amor verdadeira, com carinho, desejo e a vontade de ficar juntos.' },
  { label: 'Término', idea: 'O fim de um relacionamento, a dor da despedida e a dificuldade de seguir em frente.' },
  { label: 'Sofrência', idea: 'Alguém que ainda ama, sofre em silêncio e não consegue esquecer a pessoa amada.' },
  { label: 'Saudade', idea: 'A saudade de alguém especial, das memórias e dos momentos que não voltam mais.' },
  { label: 'Perdão', idea: 'Um pedido de perdão sincero, com arrependimento e vontade de recomeçar.' },
  { label: 'Fé', idea: 'Uma mensagem de fé, esperança e força para atravessar os momentos difíceis.' },
  { label: 'Festa', idea: 'Uma noite de festa, alegria, amizade e vontade de curtir sem pensar no amanhã.' },
  { label: 'Superação', idea: 'Uma pessoa que caiu, se levantou e descobriu a própria força no caminho.' },
]

type Result = { audio?: string; lyrics?: string; description?: string; timingPlan?: string; creativeDirection?: string; generatedLyrics?: boolean; duration?: number; phraseCount?: number; error?: string; details?: string }

const initialForm = {
  title: '', style: 'Sertanejo', customStyle: '', mood: 'Sofrência', structure: 'Padrão', lineCount: 'média',
  songLanguage: 'Português (Brasil)', idea: '', voiceGender: 'Deixar a IA escolher', voiceTone: 'Deixar a IA escolher',
  wantInstruments: '', avoidInstruments: '', extraInstructions: '', avoidCliches: true, avoidChildishRhymes: true,
  avoidRepeatedWords: true, stickyChorus: true, popularLanguage: true, sophisticatedLanguage: false,
}

export default function LyriaLabPage() {
  const [form, setForm] = useState(initialForm)
  const [styles, setStyles] = useState(defaultStyles)
  const [hasOwnLyric, setHasOwnLyric] = useState(false)
  const [lyrics, setLyrics] = useState('')
  const [bpm, setBpm] = useState('100')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/generos/list', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : [])
      .then((genres: Array<{ name?: string }>) => {
        if (!active || !Array.isArray(genres)) return
        const names = genres.map((genre) => String(genre.name || '').trim()).filter(Boolean)
        const merged = [...names, ...defaultStyles.filter((style) => style !== customStyle && !names.some((name) => name.toLowerCase() === style.toLowerCase())), customStyle]
        setStyles(merged)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  async function generate(event: FormEvent) {
    event.preventDefault()
    const style = form.style === customStyle ? form.customStyle.trim() : form.style
    if (!form.title.trim()) return setResult({ error: 'Informe o nome da música.' })
    if (!style) return setResult({ error: 'Informe o estilo musical desejado.' })
    if (hasOwnLyric && lyrics.trim().length < 20) return setResult({ error: 'Cole a letra da música antes de criar.' })
    if (!hasOwnLyric && !form.idea.trim()) return setResult({ error: 'Descreva a ideia da música antes de criar.' })

    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/lab/lyria', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, style, lyrics: hasOwnLyric ? lyrics : '', bpm, naturalProsody: true }),
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'Falha ao chamar o laboratório.', details: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-primary-400 focus:bg-black/55'
  const effectiveStyle = form.style === customStyle ? form.customStyle || 'Seu estilo' : form.style

  return (
    <main className="min-h-screen overflow-hidden bg-[#05070d] py-5 text-white sm:py-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(236,72,153,0.12),transparent_24%)]" />
      <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-w-0 space-y-5">
            <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(12,10,20,0.98),rgba(24,16,40,0.92))] p-5 shadow-2xl shadow-purple-950/20 sm:p-7">
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
              <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_235px] lg:items-center">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-300/20 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-purple-100"><FiZap /> Studio IA · Laboratório Google</div>
                  <h1 className="max-w-xl text-3xl font-black leading-tight sm:text-5xl">Sua próxima <span className="bg-gradient-to-r from-primary-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">música começa aqui</span></h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">Teste a experiência real do Studio com produção musical pelo Google Lyria.</p>
                  <div className="mt-5 flex flex-wrap gap-2">{[{ label: 'Letra profissional', Icon: FiFileText }, { label: 'Voz e instrumental', Icon: FiMusic }, { label: 'Tempo por frase', Icon: FiClock }].map(({ label, Icon }) => <span key={label} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-semibold text-gray-200"><Icon className="text-primary-300" />{label}</span>)}</div>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-4"><div className="flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-fuchsia-500"><FiPlay /></div><div className="min-w-0"><p className="truncate text-sm font-black">{form.title || 'Sua nova música'}</p><p className="truncate text-xs text-purple-200/70">{effectiveStyle} · {form.mood}</p></div></div><div className="mt-4 flex items-end gap-1">{[18, 28, 16, 34, 22, 40, 24, 32, 18, 36, 20, 30].map((height, index) => <div key={index} className="flex-1 rounded-full bg-gradient-to-t from-primary-600 to-fuchsia-400" style={{ height }} />)}</div><div className="mt-3 flex justify-between text-[11px] text-purple-100/60"><span>{bpm} BPM</span><span>{result?.duration ? formatDuration(result.duration) : 'Duração inteligente'}</span></div></div>
              </div>
            </section>

            <div className="grid grid-cols-4 gap-2">{[{ label: 'Música', Icon: FiMusic }, { label: 'Voz', Icon: FiMic }, { label: 'Letra', Icon: FiFileText }, { label: 'Produção', Icon: FiHeadphones }].map(({ label, Icon }, index) => <div key={label} className={`rounded-2xl border p-3 text-center ${index === 0 || form.title ? 'border-purple-400/30 bg-purple-950/35 text-purple-100' : 'border-white/10 bg-white/[0.03] text-gray-400'}`}><Icon className="mx-auto mb-1" /><span className="text-[11px] font-bold sm:text-xs">{label}</span></div>)}</div>

            <form onSubmit={generate} className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-gray-950/85 p-3 shadow-2xl shadow-black/30 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <SectionTitle icon={<FiMusic />} title="Informações da música" subtitle="As mesmas escolhas da criação oficial." />
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-bold">Nome da música</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value.slice(0, 30) })} placeholder="Ex.: Chave Falsa" className={inputClass} /></label>
                    <Select label="Estilo musical" value={form.style} options={styles} onChange={(style) => setForm({ ...form, style })} />
                    {form.style === customStyle ? <label><span className="mb-1.5 block text-xs font-bold">Digite o estilo</span><input value={form.customStyle} onChange={(event) => setForm({ ...form, customStyle: event.target.value })} placeholder="Ex.: piseiro romântico" className={inputClass} /></label> : <Select label="Clima da música" value={form.mood} options={moods} onChange={(mood) => setForm({ ...form, mood })} />}
                    {form.style === customStyle && <Select label="Clima da música" value={form.mood} options={moods} onChange={(mood) => setForm({ ...form, mood })} />}
                    <Select label="Tamanho da letra" value={form.lineCount} options={['curta', 'média', 'longa']} onChange={(lineCount) => setForm({ ...form, lineCount })} />
                    <Select label="Idioma da música" value={form.songLanguage} options={['Português (Brasil)', 'Español (Paraguay)', 'Español (Colombia)']} onChange={(songLanguage) => setForm({ ...form, songLanguage })} />
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-purple-300/15 bg-purple-950/[0.16] p-4 sm:p-5">
                  <SectionTitle icon={<FiMic />} title="Direção de voz" subtitle="Escolha como a música deverá ser cantada." />
                  <div className="mt-5 grid gap-3 sm:grid-cols-2"><Select label="Tipo de voz" value={form.voiceGender} options={voiceGenders} onChange={(voiceGender) => setForm({ ...form, voiceGender })} /><Select label="Característica" value={form.voiceTone} options={voiceTones} onChange={(voiceTone) => setForm({ ...form, voiceTone })} /></div>
                  <div className="mt-4 rounded-2xl border border-purple-300/15 bg-black/30 p-3.5"><p className="text-xs font-bold text-purple-100">Voz cadastrada</p><p className="mt-2 text-xs leading-relaxed text-purple-100/70">O Google Lyria cria uma voz original conforme as opções acima. Clonagem de voz não está disponível neste laboratório.</p></div>
                </section>

                <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5 lg:col-span-2">
                  <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><SectionTitle icon={<FiFileText />} title={hasOwnLyric ? 'Letra pronta' : 'Ideia da música'} subtitle={hasOwnLyric ? 'Sua letra será cantada sem alterar as palavras.' : 'A IA cria primeiro a letra e depois produz sua música.'} /><button type="button" onClick={() => { setHasOwnLyric(!hasOwnLyric); setResult(null) }} className="rounded-full border border-primary-400/35 bg-primary-500/10 px-4 py-2 text-xs font-bold text-primary-100 hover:bg-primary-500/20">{hasOwnLyric ? 'Quero gerar com IA' : 'Já tenho a letra'}</button></div>
                  {!hasOwnLyric && <div className="mb-3"><p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Sugestões de temas</p><div className="flex flex-wrap gap-2">{themes.map((theme) => <button key={theme.label} type="button" onClick={() => setForm({ ...form, idea: theme.idea })} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${form.idea === theme.idea ? 'border-primary-400/60 bg-primary-500/20 text-primary-100' : 'border-white/10 bg-black/25 text-gray-300 hover:border-primary-400/40'}`}>{theme.label}</button>)}</div></div>}
                  <textarea value={hasOwnLyric ? lyrics : form.idea} onChange={(event) => hasOwnLyric ? setLyrics(event.target.value) : setForm({ ...form, idea: event.target.value.slice(0, 1000) })} rows={hasOwnLyric ? 12 : 6} placeholder={hasOwnLyric ? '[Verso 1]\nCole aqui sua letra completa...\n\n[Refrão]\n...' : 'Ex.: Um compositor descobre que a pessoa que amava usava uma chave falsa para entrar e sair da vida dele...'} className={`${inputClass} resize-y leading-relaxed`} />
                  {hasOwnLyric && <p className="mt-3 text-xs font-semibold text-green-300">Cada frase recebe um tempo próprio, calculado conforme suas sílabas, o BPM e a duração escolhida.</p>}
                </section>

                <section className="rounded-[1.5rem] border border-primary-400/20 bg-primary-950/15 p-4 sm:p-5 lg:col-span-2"><SectionTitle icon={<FiActivity />} title="Engenharia musical DCC" subtitle="A duração é calculada automaticamente pelas frases da sua letra." /><div className="mt-5 max-w-sm"><Select label="Andamento obrigatório (BPM)" value={bpm} options={['90', '100', '110', '120']} onChange={setBpm} /></div><p className="mt-3 text-xs text-purple-100/70">A DCC calcula intro, pausas, sílabas, tempo de cada verso e finalização. Nunca usamos BPM automático.</p></section>

                <section className="lg:col-span-2"><button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-black"><span className="inline-flex items-center gap-2"><FiSliders className="text-primary-300" /> Ajustes finos</span><FiChevronDown className={showAdvanced ? 'rotate-180 transition-transform' : 'transition-transform'} /></button>{showAdvanced && <div className="mt-3 space-y-3"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{([['avoidCliches', 'Evitar clichês'], ['avoidChildishRhymes', 'Evitar rimas infantis'], ['avoidRepeatedWords', 'Evitar palavras repetidas'], ['stickyChorus', 'Refrão mais chiclete'], ['popularLanguage', 'Linguagem mais popular'], ['sophisticatedLanguage', 'Linguagem mais sofisticada']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5 text-xs font-bold text-gray-200"><input type="checkbox" checked={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} className="h-4 w-4 accent-purple-500" />{label}</label>)}</div><Select label="Estrutura da música" value={form.structure} options={['Padrão', 'A/B/Refrão/C/Refrão', 'A/Refrão/A/Refrão']} onChange={(structure) => setForm({ ...form, structure })} /><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-bold">Instrumentos que você quer</span><input value={form.wantInstruments} onChange={(event) => setForm({ ...form, wantInstruments: event.target.value })} placeholder="Ex.: viola, violão, piano" className={inputClass} /></label><label><span className="mb-1.5 block text-xs font-bold">Instrumentos para evitar</span><input value={form.avoidInstruments} onChange={(event) => setForm({ ...form, avoidInstruments: event.target.value })} placeholder="Ex.: guitarra, bateria eletrônica" className={inputClass} /></label></div><label className="block"><span className="mb-1.5 block text-xs font-bold">Instruções extras de produção</span><textarea value={form.extraInstructions} onChange={(event) => setForm({ ...form, extraInstructions: event.target.value })} rows={3} placeholder="Ex.: começo intimista, refrão forte, interpretação emocionante..." className={`${inputClass} resize-y`} /></label></div>}</section>

                <div className="lg:col-span-2"><button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-600 via-purple-600 to-fuchsia-600 px-5 py-4 font-black text-white shadow-lg shadow-purple-950/35 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">{loading ? <><FiLoader className="animate-spin" />{hasOwnLyric ? 'Produzindo sua música no Google...' : 'Criando letra e produzindo sua música...'}</> : <><FiMusic /> Criar minha música com Google</>}</button><p className="mt-2 text-center text-xs text-gray-500">Ambiente de laboratório · Nenhum crédito do Studio será descontado.</p></div>
              </div>
            </form>

            {result?.error && <section className="rounded-2xl border border-red-900/60 bg-red-950/20 p-5 text-sm"><p className="font-semibold text-red-400">{result.error}</p>{result.details && <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-zinc-400">{result.details}</pre>}</section>}
            {result?.audio && <section className="rounded-[1.75rem] border border-emerald-400/20 bg-gray-950/90 p-5 sm:p-7"><p className="mb-2 inline-flex items-center gap-2 text-sm font-black text-emerald-300"><FiCheck /> Música criada com sucesso</p><h2 className="text-2xl font-black">{form.title}</h2><p className="mt-1 text-sm text-gray-400">{effectiveStyle} · {form.mood} · {bpm} BPM{result.duration ? ` · ${formatDuration(result.duration)}` : ''}</p><audio controls className="mt-5 w-full" src={result.audio} />{result.lyrics && <details open className="mt-5 rounded-2xl border border-white/10 bg-black/40 p-4"><summary className="cursor-pointer text-sm font-bold">{result.generatedLyrics ? 'Letra criada pela IA' : 'Sua letra'}</summary><pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{result.lyrics}</pre></details>}{result.timingPlan && <details className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-4"><summary className="cursor-pointer text-sm font-bold">Engenharia DCC: tempo de cada frase</summary><pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-gray-300">{result.timingPlan}</pre></details>}{result.creativeDirection && <details className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-4"><summary className="cursor-pointer text-sm font-bold">Direção enviada ao Google</summary><pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-gray-300">{result.creativeDirection}</pre></details>}</section>}
          </div>

          <aside className="space-y-4 xl:pt-0"><div className="sticky top-5 rounded-[1.75rem] border border-white/10 bg-gray-950/85 p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-purple-300">Resumo da criação</p><h2 className="mt-3 text-xl font-black">{form.title || 'Sua nova música'}</h2><div className="mt-5 space-y-3">{[['Estilo', effectiveStyle], ['Clima', form.mood], ['Voz', form.voiceGender === 'Deixar a IA escolher' ? 'Voz original do Google' : form.voiceGender], ['Idioma', form.songLanguage], ['Andamento', `${bpm} BPM fixos`], ['Duração', result?.duration ? formatDuration(result.duration) : 'Calculada pela DCC'], ['Letra', hasOwnLyric ? 'Letra do compositor' : 'Criada com IA']].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 border-b border-white/5 pb-2"><span className="text-xs text-gray-400">{label}</span><span className="max-w-[165px] text-right text-xs font-bold text-gray-100">{value}</span></div>)}</div><div className="mt-5 rounded-2xl border border-purple-400/20 bg-purple-950/25 p-3"><p className="text-xs font-bold text-purple-100">Laboratório interno</p><p className="mt-1 text-xs leading-relaxed text-purple-100/65">A experiência imita o Studio oficial, mas a geração fica isolada no Google Lyria e não desconta créditos.</p></div></div></aside>
        </div>
      </div>
    </main>
  )
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function SectionTitle({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary-300/20 bg-primary-400/10 text-primary-200">{icon}</div><div><h2 className="text-base font-black sm:text-lg">{title}</h2><p className="mt-0.5 text-xs leading-relaxed text-gray-400">{subtitle}</p></div></div>
}

function Select({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return <label><span className="mb-1.5 block text-xs font-bold text-gray-100">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3.5 text-sm text-white outline-none transition focus:border-primary-400">{options.map((option) => <option className="bg-gray-950 text-white" key={option} value={option}>{labels?.[option] || option}</option>)}</select></label>
}
