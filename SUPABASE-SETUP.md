# 🗄️ Configuração Supabase - DCC Music

## Passo 1: Criar as Tabelas

1. Acesse seu projeto no [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá em **SQL Editor**
3. Abra o arquivo `supabase/schema.sql`
4. Copie e cole todo o conteúdo no SQL Editor
5. Clique em **Run** para executar

Isso criará:
- ✅ Tabela `users` (usuários/admin)
- ✅ Tabela `genres` (gêneros musicais)
- ✅ Tabela `videos` (vídeos do YouTube)
- ✅ Tabela `musics` (músicas)
- ✅ Índices para performance
- ✅ Triggers para `updated_at`
- ✅ Políticas RLS (Row Level Security)

## Passo 2: Popular com Dados Iniciais

### Opção 1: Via Script TypeScript (Recomendado)

```bash
# Configure as variáveis de ambiente no .env
npm install
tsx supabase/seed.ts
```

### Opção 2: Via SQL Manual

1. No Supabase SQL Editor, execute o arquivo `supabase/seed.sql`
2. **IMPORTANTE**: Gere o hash bcrypt da senha antes:
   - Use: https://bcrypt-generator.com/
   - Senha: `admin123`
   - Rounds: 10
   - Substitua o hash no SQL

## Passo 3: Verificar Variáveis de Ambiente

Certifique-se de que seu `.env` tem:

```env
NEXT_PUBLIC_SUPABASE_URL=https://hsduizbqsrfhhulcrmye.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
DATABASE_URL=postgresql://postgres.hsduizbqsrfhhulcrmye:Biw13E9WGMJqXcU1@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

## Passo 4: Instalar Dependências

```bash
npm install
```

## Estrutura das Tabelas

### users
- `id` (UUID) - Primary Key
- `email` (TEXT) - Unique, NOT NULL
- `password` (TEXT) - Hash bcrypt
- `name` (TEXT) - Opcional
- `created_at`, `updated_at` (TIMESTAMPTZ)

### genres
- `id` (UUID) - Primary Key
- `name` (TEXT) - Unique, NOT NULL
- `slug` (TEXT) - Unique, NOT NULL
- `color` (TEXT) - Cor hex opcional
- `icon` (TEXT) - Ícone opcional
- `created_at`, `updated_at` (TIMESTAMPTZ)

### videos
- `id` (UUID) - Primary Key
- `title` (TEXT) - NOT NULL
- `slug` (TEXT) - Unique, NOT NULL
- `youtube_url` (TEXT) - NOT NULL
- `youtube_id` (TEXT) - NOT NULL
- `genre_id` (UUID) - Foreign Key → genres
- `tags` (TEXT) - Opcional
- `description` (TEXT) - Opcional
- `published_at` (TIMESTAMPTZ) - Default NOW()
- `featured` (BOOLEAN) - Default FALSE
- `thumbnail_url` (TEXT) - Opcional
- `duration` (TEXT) - Opcional
- `view_count` (INTEGER) - Default 0
- `created_at`, `updated_at` (TIMESTAMPTZ)

### musics
- `id` (UUID) - Primary Key
- `title` (TEXT) - NOT NULL
- `slug` (TEXT) - Unique, NOT NULL
- `genre_id` (UUID) - Foreign Key → genres
- `spotify_url` (TEXT) - Opcional
- `spotify_embed` (TEXT) - Opcional (iframe)
- `apple_music_url` (TEXT) - Opcional
- `apple_music_embed` (TEXT) - Opcional (iframe)
- `tags` (TEXT) - Opcional
- `description` (TEXT) - Opcional
- `cover_url` (TEXT) - Opcional
- `featured` (BOOLEAN) - Default FALSE
- `published_at` (TIMESTAMPTZ) - Default NOW()
- `created_at`, `updated_at` (TIMESTAMPTZ)

## Segurança (RLS)

- ✅ `genres`, `videos`, `musics`: Públicos para leitura
- ✅ `users`: Privados (apenas admin)
- ✅ Operações de escrita (INSERT/UPDATE/DELETE) devem ser feitas via API com autenticação

## Próximos Passos

Após criar as tabelas:
1. Execute o seed para popular dados iniciais
2. Teste o site localmente
3. Faça deploy no Vercel
