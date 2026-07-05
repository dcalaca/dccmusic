import VerifyComposerEmailClient from './VerifyComposerEmailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function VerifyComposerEmailPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  return <VerifyComposerEmailClient token={searchParams.token || ''} />
}
