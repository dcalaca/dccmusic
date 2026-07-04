# 🚀 Guia de Deploy - DCC Music

## Deploy no Vercel

### Método 1: Deploy via Vercel CLI (Recomendado - Sem GitHub)

### Passo 1: Instalar Vercel CLI

```bash
npm install -g vercel
```

### Passo 2: Fazer Login no Vercel

```bash
vercel login
```

Siga as instruções para autenticar no navegador.

### Passo 3: Deploy do Projeto

No diretório do projeto, execute:

```bash
vercel
```

Siga as instruções:
- **Set up and deploy?** → Y
- **Which scope?** → Selecione sua conta
- **Link to existing project?** → N (primeira vez)
- **What's your project's name?** → dccmusic (ou o nome que preferir)
- **In which directory is your code located?** → ./ (pressione Enter)

### Passo 4: Configurar Variáveis de Ambiente

Após o primeiro deploy, configure as variáveis:

```bash
vercel env add DATABASE_URL
# Cole: postgresql://postgres.hsduizbqsrfhhulcrmye:Biw13E9WGMJqXcU1@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1

vercel env add NEXTAUTH_URL
# Cole: https://seu-projeto.vercel.app (atualize após primeiro deploy)

vercel env add NEXTAUTH_SECRET
# Cole: callcenter-secret-key-change-in-production-813663756

vercel env add ADMIN_EMAIL
# Cole: admin@dccmusic.com

vercel env add ADMIN_PASSWORD
# Cole: admin123
```

Ou configure via Dashboard do Vercel:
1. Acesse [vercel.com/dashboard](https://vercel.com/dashboard)
2. Selecione seu projeto
3. Vá em **Settings > Environment Variables**
4. Adicione cada variável manualmente

### Passo 5: Deploy para Produção

```bash
vercel --prod
```

### Método 2: Deploy via Dashboard (Upload Manual)

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New Project"**
3. Clique em **"Browse"** ou arraste a pasta do projeto
4. Configure as variáveis de ambiente (veja Passo 3)
5. Clique em **"Deploy"**

### Passo 3: Configurar Variáveis de Ambiente (via Dashboard)

No Vercel Dashboard, vá em **Settings > Environment Variables** e adicione:

#### Variáveis Obrigatórias:

```
DATABASE_URL=postgresql://postgres.hsduizbqsrfhhulcrmye:Biw13E9WGMJqXcU1@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

```
NEXTAUTH_URL=https://seu-projeto.vercel.app
```
*(Atualize após o primeiro deploy com a URL real do Vercel)*

```
NEXTAUTH_SECRET=callcenter-secret-key-change-in-production-813663756
```

```
ADMIN_EMAIL=admin@dccmusic.com
```

```
ADMIN_PASSWORD=admin123
```

#### Variáveis Opcionais (se usar Supabase):

```
NEXT_PUBLIC_SUPABASE_URL=https://hsduizbqsrfhhulcrmye.supabase.co
```

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_0k6BjCY9Ze0Myj1vSR01BA_WhUjarA_
```

```
SUPABASE_SERVICE_ROLE_KEY=sb_publishable_0k6BjCY9Ze0Myj1vSR01BA_WhUjarA_
```

### Passo 4: Configurar Build Settings

No Vercel, em **Settings > General**:

- **Framework Preset:** Next.js
- **Build Command:** `prisma generate && prisma migrate deploy && next build`
- **Output Directory:** `.next` (padrão)
- **Install Command:** `npm install`

### Passo 5: Fazer o Deploy

1. Clique em **"Deploy"**
2. Aguarde o build completar
3. Após o deploy, copie a URL do projeto (ex: `https://dccmusic.vercel.app`)

### Passo 6: Atualizar NEXTAUTH_URL

1. Vá em **Settings > Environment Variables**
2. Atualize `NEXTAUTH_URL` com a URL real do Vercel:
   ```
   NEXTAUTH_URL=https://seu-projeto.vercel.app
   ```
3. Faça um novo deploy (ou aguarde o redeploy automático)

### Passo 7: Configurar Banco de Dados

Após o primeiro deploy, você precisa rodar as migrations no Supabase:

**Opção 1: Via Prisma Studio local**
```bash
# Configure DATABASE_URL no .env local apontando para Supabase
npm run db:push
npm run db:seed
```

**Opção 2: Via Vercel CLI**
```bash
vercel env pull .env.local
npx prisma migrate deploy
npx prisma db seed
```

**Opção 3: Via Supabase Dashboard**
- Acesse o SQL Editor no Supabase
- Execute o SQL gerado pelo Prisma

## 🌐 Conectar Domínio Personalizado

### Passo 1: Adicionar Domínio no Vercel

1. No projeto Vercel, vá em **Settings > Domains**
2. Clique em **"Add Domain"**
3. Digite seu domínio (ex: `dccmusic.com` ou `www.dccmusic.com`)
4. Siga as instruções para configurar DNS

### Passo 2: Configurar DNS

Adicione os seguintes registros no seu provedor de DNS:

**Para domínio raiz (dccmusic.com):**
```
Tipo: A
Nome: @
Valor: 76.76.21.21
```

**Para subdomínio www (www.dccmusic.com):**
```
Tipo: CNAME
Nome: www
Valor: cname.vercel-dns.com
```

### Passo 3: Atualizar NEXTAUTH_URL

Após o domínio estar funcionando:

1. Vá em **Settings > Environment Variables**
2. Atualize `NEXTAUTH_URL`:
   ```
   NEXTAUTH_URL=https://dccmusic.com
   ```
   ou
   ```
   NEXTAUTH_URL=https://www.dccmusic.com
   ```
3. Faça um novo deploy

### Passo 4: SSL Automático

O Vercel configura SSL automaticamente. Aguarde alguns minutos após configurar o DNS.

## 📝 Checklist Pós-Deploy

- [ ] Banco de dados configurado e migrations rodadas
- [ ] Seed executado (dados iniciais)
- [ ] NEXTAUTH_URL atualizado com URL de produção
- [ ] Testar login admin
- [ ] Testar criação de conteúdo
- [ ] Domínio configurado (se aplicável)
- [ ] SSL funcionando

## 🔧 Troubleshooting

### Erro de conexão com banco
- Verifique se `DATABASE_URL` está correto
- Certifique-se de que o Supabase permite conexões externas
- Use a connection string com `pgbouncer=true` para melhor performance

### Erro de autenticação
- Verifique se `NEXTAUTH_URL` está correto
- Certifique-se de que `NEXTAUTH_SECRET` está configurado
- Limpe cookies e tente novamente

### Build falha
- Verifique os logs no Vercel
- Certifique-se de que todas as dependências estão no `package.json`
- Verifique se o Prisma está gerando corretamente

## 📚 Recursos

- [Documentação Vercel](https://vercel.com/docs)
- [Prisma com PostgreSQL](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- [NextAuth.js Deployment](https://next-auth.js.org/configuration/options#nextauth_url)
