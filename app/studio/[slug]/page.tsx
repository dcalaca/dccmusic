import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FiShare2 } from 'react-icons/fi'
import { supabaseAdmin } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import StudioPreviewPlayer from '@/components/StudioPreviewPlayer'
import CopyButton from '@/components/CopyButton'
import RatingAndComments from '@/components/RatingAndComments'
import { getStudioVersionAudioUrls } from '@/lib/studio-audio-backup'
import { getStudioCoverImageUrl } from '@/lib/studio-cover-url'

export const dynamic = 'force-dynamic'

function extractVoicePreferences(description?: string | null) {
  const match = String(description || '').match(/Preferência de voz:\s*(.+)/i)
  return match?.[1]?.trim() || ''
}

async function getStudioMusic(slug: string) {
  const { data: project, error } = await supabaseAdmin
    .from('studio_projects')
    .select('*, composer:dccmusic_composers(id, name, slug)')
    .eq('public_slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error || !project) return null

  const [{ data: lyric }, { data: version }, { data: covers }] = await Promise.all([
    supabaseAdmin.from('studio_lyrics').select('*').eq('project_id', project.id).eq('is_current', true).maybeSingle(),
    supabaseAdmin.from('studio_versions').select('*').eq('project_id', project.id).eq('is_published', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from('studio_covers').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
  ])

  if (!version) return null

  const currentCover = (covers || []).find((cover: any) => cover.is_current) || covers?.[0] || null
  const coverUrl = await getStudioCoverImageUrl(currentCover)

  const versionAudio = await getStudioVersionAudioUrls(version)
  return { project, lyric, version, coverUrl, versionAudio }
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const data = await getStudioMusic(params.slug)
  if (!data) return { title: 'Música não encontrada' }

  return {
    title: `${data.project.title} | DCC Studio IA`,
    description: `Ouça ${data.project.title}, criado com DCC Studio IA.`,
  }
}

export default async function StudioPublicMusicPage({ params }: { params: { slug: string } }) {
  const data = await getStudioMusic(params.slug)
  if (!data) notFound()

  const { project, lyric, versionAudio, coverUrl } = data
  const audioUrl = versionAudio.audioUrl || versionAudio.streamAudioUrl
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'https://www.dccmusic.online').replace(/\/$/, '')
  const pageUrl = `${siteUrl}/studio/${project.public_slug}`
  const voicePreferences = extractVoicePreferences(project.description)

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <aside>
              <div className="overflow-hidden rounded-3xl border border-gray-800 bg-black/70">
                <div className="aspect-square bg-gradient-to-br from-gray-900 to-purple-950">
                  {coverUrl && <img src={coverUrl} alt={project.title} className="h-full w-full object-cover" />}
                </div>
                <div className="p-5">
                  <span className="inline-flex rounded-full bg-primary-900/60 px-3 py-1 text-xs text-primary-200">
                    Criado com DCC Studio IA
                  </span>
                </div>
              </div>
            </aside>

            <main>
              <h1 className="text-4xl sm:text-5xl font-black mb-3">
                <span className="gradient-text">{project.title}</span>
              </h1>
              <div className="mb-6 flex flex-wrap gap-3 text-sm text-gray-400">
                <span>{project.style || 'Livre'}</span>
                <span>{project.mood || 'Sem clima'}</span>
                {project.published_at && <span>{formatDate(project.published_at)}</span>}
              </div>

              <section className="mb-6 rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Preferências da criação</h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-primary-950 px-3 py-1 text-primary-100">Estilo: {project.style || 'Livre'}</span>
                  <span className="rounded-full bg-purple-950 px-3 py-1 text-purple-100">Clima: {project.mood || 'Livre'}</span>
                  {project.structure && <span className="rounded-full bg-gray-800 px-3 py-1 text-gray-200">Estrutura: {project.structure}</span>}
                  {project.line_count && <span className="rounded-full bg-gray-800 px-3 py-1 text-gray-200">Linhas: {project.line_count}</span>}
                  {voicePreferences && <span className="rounded-full bg-fuchsia-950 px-3 py-1 text-fuchsia-100">Voz: {voicePreferences}</span>}
                </div>
              </section>

              {project.composer && (
                <p className="mb-6 text-gray-300">
                  Compositor:{' '}
                  <Link href={`/compositores/${project.composer.slug}`} className="text-primary-300 hover:text-primary-200">
                    {project.composer.name}
                  </Link>
                </p>
              )}

              {audioUrl && (
                <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
                  <StudioPreviewPlayer audioUrl={audioUrl} premium />
                </div>
              )}

              <div className="mb-8 flex flex-wrap gap-3">
                <CopyButton text={pageUrl} label="Copiar link" />
                <button className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2">
                  <FiShare2 /> Compartilhar
                </button>
              </div>

              {lyric?.content && (
                <section className="mb-8 rounded-3xl border border-gray-800 bg-gray-950/70 p-6">
                  <h2 className="text-2xl font-bold mb-4">Letra</h2>
                  <p className="whitespace-pre-line leading-relaxed text-gray-300">{lyric.content}</p>
                </section>
              )}

              <RatingAndComments contentType="studio_music" contentId={project.id} />
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
