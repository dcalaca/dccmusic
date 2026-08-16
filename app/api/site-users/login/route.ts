import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Use o login de compositor. Com essa conta você também comenta, avalia e cria músicas.',
      redirectTo: '/compositores/login',
    },
    { status: 410 }
  )
}
