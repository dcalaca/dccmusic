import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'O cadastro de ouvinte foi desativado. Crie uma conta de compositor: com ela você comenta, avalia e cria músicas.',
      redirectTo: '/compositores/cadastro',
    },
    { status: 410 }
  )
}
