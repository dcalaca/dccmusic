# 🔧 Configurar Variáveis de Ambiente no Vercel

## ⚠️ IMPORTANTE

Após o deploy, você precisa configurar as variáveis de ambiente no Vercel para o site funcionar corretamente.

## Método 1: Via Dashboard (Recomendado)

1. Acesse: https://vercel.com/douglas-projects-0a1abb80/dccmusic/settings/environment-variables

2. Adicione as seguintes variáveis (uma por vez):

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
https://dccmusic.vercel.app
```

```
NEXTAUTH_SECRET
[Use o mesmo valor do seu .env local]
```

```
ADMIN_EMAIL
dcalaca@gmail.com
```

```
ADMIN_PASSWORD
5778
```

### Configurações:

- **Environment**: Selecione todas (Production, Preview, Development)
- Clique em **Save** após cada variável

## Método 2: Via CLI

Execute os comandos abaixo (substitua os valores pelos seus):

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Cole: https://hsduizbqsrfhhulcrmye.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Cole: sb_publishable_0k6BjCY9Ze0Myj1vSR01BA_WhUjarA_

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Cole: sb_publishable_0k6BjCY9Ze0Myj1vSR01BA_WhUjarA_

vercel env add NEXTAUTH_URL production
# Cole: https://dccmusic.vercel.app

vercel env add NEXTAUTH_SECRET production
# Cole: [seu secret do .env]

vercel env add ADMIN_EMAIL production
# Cole: dcalaca@gmail.com

vercel env add ADMIN_PASSWORD production
# Cole: 5778
```

## Após Configurar

1. Faça um novo deploy:
   ```bash
   vercel --prod
   ```

2. Ou aguarde o redeploy automático (pode levar alguns minutos)

## Verificar se Funcionou

1. Acesse: https://dccmusic.vercel.app
2. Teste o login admin (5 cliques no rodapé)
3. Verifique se consegue acessar `/admin`

## ⚠️ Lembrete

- Execute o SQL de migração (`SQL-MIGRAR-GENEROS-DINAMICOS.sql`) no Supabase antes de usar
- As variáveis de ambiente são essenciais para o funcionamento do site
