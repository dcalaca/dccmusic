# DCC Music

Plataforma web do artista/gravadora DCC Music: hub de vídeos e músicas, painel administrativo, área de compositores, assinaturas, Studio IA (geração de música/voz/capa por IA), destaque pago, links rastreáveis, parceiros/afiliados e campanhas de e-mail.

## Stack real

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** (dark mode)
- **Supabase (PostgreSQL)** — banco de dados principal, acessado via `@supabase/supabase-js`
  - No servidor usamos a chave **service_role** (`lib/supabase.ts`), que ignora RLS. Toda autorização é feita nas próprias rotas de API.
- **NextAuth** — login do painel admin (`/admin`)
- **JWT próprio** — login de compositores e parceiros (não usa NextAuth)
- **Mercado Pago** — pagamentos (assinaturas, recarga avulsa do Studio, destaque pago)
- **Suno / Mureka** — geração de música e voz por IA
- **OpenAI** — geração de capas
- **Cloudflare R2** — backup interno dos áudios do Studio
- **Resend** — e-mails transacionais e campanhas
- **Meta / TikTok** — API de conversões (rastreamento)
- **Vercel** — hospedagem e execução dos crons

> Observação: existe um `prisma/schema.prisma` legado no projeto, mas o banco em produção é o Supabase e o acesso é feito direto pelo cliente Supabase. O Prisma **não** é a fonte de verdade do schema.

## Estrutura do projeto

```
dccmusic/
├── app/                    # Páginas e rotas (App Router)
│   ├── admin/              # Painel administrativo (NextAuth)
│   ├── compositores/       # Área e API dos compositores
│   ├── parceiros/          # Área de parceiros/afiliados
│   ├── api/                # Rotas de API (inclui webhooks e crons)
│   ├── musicas/ videos/    # Páginas públicas
│   └── l/ r/               # Links rastreáveis e códigos de parceiro
├── components/             # Componentes React
├── lib/                    # Regras de negócio, integrações e helpers
├── database/               # Scripts SQL de setup/manutenção (rodados no Supabase)
├── supabase/               # Seed
└── types/                  # Tipos TypeScript
```

## Variáveis de ambiente

As variáveis ficam na Vercel (Production) e localmente em `.env.local`. Para puxar as de produção para o `.env.local`:

```bash
vercel env pull .env.local --environment=production
```

Principais grupos:

- **Banco/Auth:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- **Pagamentos:** `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`
- **IA/Mídia:** `SUNOAPI_KEY`, `MUREKA_API_KEY`, `OPENAI_API_KEY`, `CLOUDFLARE_R2_*`
- **E-mail:** `RESEND_*`
- **Rastreamento:** `META_*`, `TIKTOK_*`
- **Segurança de tarefas/callbacks:** `CRON_SECRET`, `STUDIO_CALLBACK_SECRET`

## Scripts disponíveis

```bash
npm run dev     # Servidor de desenvolvimento
npm run build   # Build de produção
npm run start   # Servidor de produção
npm run lint    # Lint
npm run test    # Testes (Vitest)
npm run db:seed # Popular dados de exemplo (supabase/seed.ts)
```

## Segurança (pontos importantes)

- **Webhooks Mercado Pago** (`/api/compositores/pagamento/webhook`, `/api/compositores/featured/webhook`): validam a assinatura secreta (`MERCADOPAGO_WEBHOOK_SECRET`) e o webhook de pagamento **sempre confirma o pagamento consultando a API do Mercado Pago** (nunca confia no corpo da notificação).
- **Callbacks do Studio (Suno)** (`/api/studio/suno/*`): exigem o segredo `STUDIO_CALLBACK_SECRET`, enviado na URL de callback e validado no recebimento.
- **Crons** (`/api/cron/*`): exigem `Authorization: Bearer <CRON_SECRET>`. A Vercel injeta esse header automaticamente quando `CRON_SECRET` está configurado.

## Deploy

O projeto é publicado na Vercel via CLI (não há repositório Git conectado):

```bash
vercel --prod
```

Os crons são definidos em `vercel.json`.
