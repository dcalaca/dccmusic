import { NextRequest, NextResponse } from 'next/server'

export function GET(request: NextRequest, { params }: { params: { partnerCode: string } }) {
  const url = new URL(request.url)
  const target = new URL('/', url.origin)
  target.searchParams.set('partner', params.partnerCode)
  return NextResponse.redirect(target, 302)
}

