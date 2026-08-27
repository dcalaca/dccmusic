import Link from 'next/link'

export default function AdminComposerStudioLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  return (
    <>
      <div className="container mx-auto px-4 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-2">
          <Link
            href={`/admin/compositores/${params.id}/studio`}
            className="rounded-xl border border-purple-700/60 bg-purple-950/40 px-4 py-2 text-sm font-bold text-purple-100 hover:bg-purple-900/60"
          >
            Studio IA
          </Link>
          <Link
            href={`/admin/compositores/${params.id}/studio/playbacks`}
            className="rounded-xl border border-cyan-700/60 bg-cyan-950/40 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-900/60"
          >
            Playbacks e vozes
          </Link>
        </div>
      </div>
      {children}
    </>
  )
}
