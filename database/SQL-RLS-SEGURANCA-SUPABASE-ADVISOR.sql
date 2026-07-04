-- ============================================================
-- RLS + remoção de políticas permissivas — só tabelas dccmusic_* (Supabase Advisor)
-- ============================================================
-- Mesmo banco com Music DCC + outros apps? Use em vez disso:
--   SQL-RLS-SEGURANCA-PUBLIC-TODAS-TABELAS.sql
-- ============================================================
-- Resolve alertas do tipo:
--   - "Table publicly accessible" / rls_disabled_in_public
--   - "Sensitive data publicly accessible" / sensitive_columns_exposed
--
-- O app Next.js usa SUPABASE_SERVICE_ROLE_KEY no servidor; essa chave
-- IGNORA Row Level Security no Postgres do Supabase. Por isso, após este
-- script, chamadas com a chave ANÔNIMA (NEXT_PUBLIC_SUPABASE_ANON_KEY)
-- deixam de ler/alterar essas tabelas — o que é o comportamento desejado.
--
-- ANTES DE RODAR:
-- 1. Confirme SUPABASE_SERVICE_ROLE_KEY nas variáveis (Vercel / .env local).
-- 2. Garanta que o código do site não depende do cliente anon para essas
--    tabelas (o projeto DCC Music usa supabaseAdmin no servidor).
-- 3. Execute no SQL Editor do projeto CORRETO (ex.: supabase-yellow-tree).
--    Outro projeto (ex.: CallCenter) precisa de script equivalente às tabelas dele.
-- ============================================================

-- 1) Remover todas as políticas RLS das tabelas dccmusic_* (inclui
--    políticas antigas "USING (true)" que expunham anon a INSERT/UPDATE).
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename LIKE 'dccmusic\_%' ESCAPE '\'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  END LOOP;
END $$;

-- 2) Ativar RLS em todas as tabelas públicas dccmusic_*
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'dccmusic\_%' ESCAPE '\'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- ============================================================
-- Resultado: sem políticas + RLS ativo = negado para anon/authenticated
-- via API PostgREST; service_role continua com acesso total (backend).
--
-- Verificação rápida (opcional):
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename LIKE 'dccmusic\_%' ESCAPE '\';
-- ============================================================
