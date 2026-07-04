# 🔧 Solução Definitiva: Erro RLS ao Criar Assinatura

## ❌ Erro Atual
```
Erro ao criar assinatura: new row violates row-level security policy for table "dccmusic_subscriptions"
```

## 🔍 Causa
As políticas RLS (Row Level Security) do Supabase estão bloqueando INSERT mesmo quando usamos o `supabaseAdmin` (service role key).

## ✅ Solução em 3 Passos

### Passo 1: Executar SQL no Supabase

1. Acesse: https://supabase.com → Seu Projeto → **SQL Editor**
2. Execute o arquivo: `SQL-FORCAR-RLS-SUBSCRIPTIONS.sql`
3. Verifique se não há erros

Este SQL vai:
- Desabilitar RLS temporariamente
- Remover todas as políticas antigas
- Criar políticas permissivas novas
- Reabilitar RLS

### Passo 2: Verificar Variável de Ambiente no Vercel

1. Acesse: https://vercel.com → Seu Projeto → **Settings** → **Environment Variables**
2. Verifique se existe: `SUPABASE_SERVICE_ROLE_KEY`
3. Se não existir, adicione:
   - **Key:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** Cole o Service Role Key do Supabase (encontre em: Settings → API → service_role key)
   - **Environments:** Production, Preview, Development

### Passo 3: Fazer Redeploy

```bash
vercel --prod
```

Ou pelo dashboard do Vercel: **Deployments** → **Redeploy**

## 🧪 Testar

1. Acesse: `/compositores/planos`
2. Clique em "Assinar"
3. Deve redirecionar para o Mercado Pago sem erros

## 📋 Verificação

Execute este SQL no Supabase para verificar se as políticas foram criadas:

```sql
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies 
WHERE tablename IN ('dccmusic_subscriptions', 'dccmusic_payments')
ORDER BY tablename, policyname;
```

Deve mostrar:
- `Permitir insert assinaturas` (INSERT)
- `Permitir update assinaturas` (UPDATE)
- `Assinaturas ativas são públicas` (SELECT)
- `Permitir insert pagamentos` (INSERT)
- `Permitir update pagamentos` (UPDATE)
- `Compositor pode ver seus pagamentos` (SELECT)

## ⚠️ Importante

- O `SUPABASE_SERVICE_ROLE_KEY` deve estar configurado no Vercel
- As políticas RLS devem permitir INSERT/UPDATE
- Após executar o SQL, faça redeploy no Vercel

## 🆘 Se Ainda Não Funcionar

1. Verifique os logs do Vercel: `vercel logs`
2. Verifique se o service role key está correto
3. Execute novamente o SQL-FORCAR-RLS-SUBSCRIPTIONS.sql
4. Verifique se não há outras políticas conflitantes
