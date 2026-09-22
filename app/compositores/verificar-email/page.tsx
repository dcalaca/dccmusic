import VerifyComposerEmailClient from './VerifyComposerEmailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function VerifyComposerEmailPage({
  searchParams,
}: {
  searchParams: { token?: string; lang?: string }
}) {
  const language = searchParams.lang === 'en' || searchParams.lang === 'es' ? searchParams.lang : 'pt'
  return <VerifyComposerEmailClient token={searchParams.token || ''} language={language} />
}
