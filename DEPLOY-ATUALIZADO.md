# 🚀 Deploy Atualizado - DCC Music

## ⚠️ IMPORTANTE: Antes do Deploy

Execute o SQL do sistema de links rastreáveis no Supabase:
1. Acesse o Supabase Dashboard → SQL Editor
2. Execute o arquivo: `SQL-CRIAR-SISTEMA-LINKS-RASTREAVEIS.sql`

## Método Rápido: Vercel CLI

### 1. Instalar Vercel CLI (se ainda não tiver)
```bash
npm install -g vercel
```

### 2. Login no Vercel
```bash
vercel login
```

### 3. Deploy para Produção
```bash
# No diretório do projeto
vercel --prod
```

## Variáveis de Ambiente Necessárias

Configure no Vercel Dashboard: https://vercel.com/dashboard → Seu Projeto → Settings → Environment Variables

### Variáveis Obrigatórias:

```
NEXT_PUBLIC_SUPABASE_URL
https://hsduizbqsrfhhulcrmye.supabase.co
```

```
NEXT_PUBLIC_SUPABASE_ANON_KEY
sb_publishable_0k6BjCY9Ze0Myj1vSR01BA_WhUjarA_
```

```
SUPABASE_SERVICE_ROLE_KEY
sb_publishable_0k6BjCY9Ze0Myj1vSR01BA_WhUjarA_
```

```
NEXTAUTH_URL
https://www.dccmusic.online
```

```
NEXTAUTH_SECRET
callcenter-secret-key-change-in-production-813663756
```

```
ADMIN_EMAIL
dcalaca@gmail.com
```

```
ADMIN_PASSWORD
5778
```

### Variáveis Opcionais (para links rastreáveis):

```
NEXT_PUBLIC_BASE_URL
https://www.dccmusic.online
```

**Nota:** Se não configurar `NEXT_PUBLIC_BASE_URL`, o sistema usará automaticamente `VERCEL_URL` que já está disponível no Vercel.

## Checklist Pós-Deploy

- [ ] Executar SQL de links rastreáveis no Supabase
- [ ] Verificar se todas as variáveis de ambiente estão configuradas
- [ ] Testar criação de link rastreável: `/links`
- [ ] Testar redirecionamento: `/l/[codigo]`
- [ ] Testar estatísticas: `/api/links/[codigo]`
- [ ] Verificar se o site está funcionando corretamente

## URLs Importantes

- **Site:** https://www.dccmusic.online
- **Criar Links:** https://www.dccmusic.online/links
- **Admin:** https://www.dccmusic.online/admin
