# Solução: Erro RLS ao Criar Assinatura

## Erro Encontrado
```
Erro ao criar assinatura: new row violates row-level security policy for table "dccmusic_subscriptions"
```

## Causa
As políticas RLS (Row Level Security) do Supabase estão bloqueando INSERT na tabela `dccmusic_subscriptions`.

## Solução

### Passo 1: Executar SQL no Supabase

1. Acesse o Supabase: https://supabase.com
2. Vá no seu projeto
3. Clique em **"SQL Editor"** no menu lateral
4. Cole o conteúdo do arquivo `SQL-CORRIGIR-RLS-SUBSCRIPTIONS.sql`
5. Clique em **"Run"** ou pressione `Ctrl+Enter`

### Passo 2: Verificar Service Role Key no Vercel

Certifique-se de que `SUPABASE_SERVICE_ROLE_KEY` está configurado no Vercel:

1. Vercel → Projeto → Settings → Environment Variables
2. Verifique se existe: `SUPABASE_SERVICE_ROLE_KEY`
3. Se não existir, adicione:
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** Cole o Service Role Key do Supabase
   - **Environment:** Production, Preview, Development
   - **Save**

### Passo 3: Como Obter Service Role Key

1. Supabase → Projeto → Settings → API
2. Na seção "Project API keys"
3. Copie a **"service_role"** key (não a anon key!)
4. Cole no Vercel

### Passo 4: Fazer Redeploy

Após executar o SQL e configurar a variável:

```bash
vercel --prod
```

Ou via web:
- Vercel → Deployments → 3 pontinhos → Redeploy

## SQL para Executar

O arquivo `SQL-CORRIGIR-RLS-SUBSCRIPTIONS.sql` contém:

```sql
-- Política: Permitir INSERT em assinaturas
DROP POLICY IF EXISTS "Permitir insert assinaturas" ON dccmusic_subscriptions;
CREATE POLICY "Permitir insert assinaturas" ON dccmusic_subscriptions
  FOR INSERT WITH CHECK (true);

-- Política: Permitir UPDATE em assinaturas
DROP POLICY IF EXISTS "Permitir update assinaturas" ON dccmusic_subscriptions;
CREATE POLICY "Permitir update assinaturas" ON dccmusic_subscriptions
  FOR UPDATE USING (true) WITH CHECK (true);

-- Política: Permitir INSERT em pagamentos
DROP POLICY IF EXISTS "Permitir insert pagamentos" ON dccmusic_payments;
CREATE POLICY "Permitir insert pagamentos" ON dccmusic_payments
  FOR INSERT WITH CHECK (true);

-- Política: Permitir UPDATE em pagamentos
DROP POLICY IF EXISTS "Permitir update pagamentos" ON dccmusic_payments;
CREATE POLICY "Permitir update pagamentos" ON dccmusic_payments
  FOR UPDATE USING (true) WITH CHECK (true);
```

## Após Executar

1. ✅ SQL executado no Supabase
2. ✅ `SUPABASE_SERVICE_ROLE_KEY` configurado no Vercel
3. ✅ Redeploy feito
4. ✅ Testar novamente criando uma assinatura

## Verificar se Funcionou

Tente criar uma assinatura novamente:
1. Acesse `/compositores/planos`
2. Clique em "Assinar Agora"
3. Se não der erro, está funcionando! ✅
