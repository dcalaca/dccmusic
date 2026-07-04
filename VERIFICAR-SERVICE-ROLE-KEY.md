# 🔑 Verificar Service Role Key

## Problema Identificado

Os erros de RLS indicam que a `SUPABASE_SERVICE_ROLE_KEY` pode não estar configurada corretamente.

## Como Verificar

1. Acesse o **Supabase Dashboard**
2. Vá em **Settings** → **API**
3. Procure por **service_role** key (não a anon key!)
4. A service role key deve começar diferente de `sb_publishable_`

## Diferença entre as Keys

- **Anon Key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`): 
  - Começa com `sb_publishable_` ou `eyJ...`
  - Respeita RLS policies
  - Usada no frontend

- **Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY`):
  - Geralmente começa com `eyJ...` (JWT token)
  - **Bypassa RLS automaticamente**
  - Usada apenas no backend/seed

## Solução

1. Copie a **service_role** key do Supabase Dashboard
2. Atualize no arquivo `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
   ```
3. Execute o seed novamente:
   ```bash
   npm run db:seed
   ```

## Alternativa: Criar Políticas RLS

Se não conseguir a service role key correta, execute o script SQL:
```sql
-- Execute SQL-CORRIGIR-POLITICAS-RLS.sql no Supabase SQL Editor
```

Isso criará políticas que permitem INSERT mesmo sem service role key.
