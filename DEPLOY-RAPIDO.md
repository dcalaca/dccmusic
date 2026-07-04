# 🚀 Deploy Rápido - DCC Music (Sem GitHub)

## Método 1: Vercel CLI (Mais Rápido)

### 1. Instalar Vercel CLI
```bash
npm install -g vercel
```

### 2. Login
```bash
vercel login
```

### 3. Deploy
```bash
# No diretório do projeto
vercel
```

Siga as instruções e depois:
```bash
vercel --prod
```

### 4. Configurar Variáveis

Via CLI:
```bash
vercel env add DATABASE_URL production
# Cole sua connection string do Supabase

vercel env add NEXTAUTH_URL production  
# Cole: https://seu-projeto.vercel.app

vercel env add NEXTAUTH_SECRET production
vercel env add ADMIN_EMAIL production
vercel env add ADMIN_PASSWORD production
```

Ou via Dashboard:
- Acesse vercel.com/dashboard
- Seu projeto > Settings > Environment Variables
- Adicione cada variável

### 5. Atualizar NEXTAUTH_URL

Após o deploy, copie a URL do projeto e atualize:
```bash
vercel env rm NEXTAUTH_URL production
vercel env add NEXTAUTH_URL production
# Cole a URL real: https://dccmusic-xxxxx.vercel.app
```

### 6. Configurar Banco

```bash
# Configure DATABASE_URL localmente apontando para Supabase
npx prisma migrate deploy
npm run db:seed
```

## Método 2: Dashboard Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Clique em **"Add New Project"**
3. Arraste a pasta do projeto ou use **"Browse"**
4. Configure variáveis de ambiente
5. Clique em **"Deploy"**

## Variáveis Necessárias

```
DATABASE_URL=postgresql://postgres.hsduizbqsrfhhulcrmye:Biw13E9WGMJqXcU1@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

NEXTAUTH_URL=https://seu-projeto.vercel.app

NEXTAUTH_SECRET=callcenter-secret-key-change-in-production-813663756

ADMIN_EMAIL=admin@dccmusic.com

ADMIN_PASSWORD=admin123
```

## Conectar Domínio

1. Vercel Dashboard > Seu Projeto > Settings > Domains
2. Adicione seu domínio
3. Configure DNS conforme instruções
4. Atualize `NEXTAUTH_URL` com o novo domínio
