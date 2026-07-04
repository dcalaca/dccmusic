import { NextResponse } from 'next/server'

export async function GET() {
  // Retornar informações básicas do admin
  // Em produção, você pode buscar isso do banco de dados ou variáveis de ambiente
  return NextResponse.json({
    email: process.env.ADMIN_EMAIL || 'admin@dccmusic.com',
  })
}
