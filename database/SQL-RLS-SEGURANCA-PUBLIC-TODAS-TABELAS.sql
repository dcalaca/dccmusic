-- ============================================================
-- RLS no schema public — TODAS as tabelas (vários projetos no mesmo Supabase)
-- ============================================================
-- Remove todas as políticas RLS das tabelas listadas em pg_policies (public)
-- e ativa RLS em todas as tabelas base em public, exceto as que você
-- colocar em "tabelas_excluidas" abaixo.
--
-- Efeito: roles anon / authenticated (API REST com chave anon) ficam SEM
-- acesso a linhas dessas tabelas, enquanto não existirem políticas explícitas.
-- A chave SERVICE_ROLE do Supabase continua ignorando RLS (uso no backend).
--
-- ATENÇÃO
-- — Rode em UM projeto/banco por vez no SQL Editor.
-- — Se algum app (mobile, outro front) usa só a ANON key direto no PostgREST
--   para ler essas tabelas, ele VAI parar até você criar políticas finas
--   (ex.: SELECT público só para colunas seguras) ou migrar para API própria.
-- — Confirme SUPABASE_SERVICE_ROLE_KEY em todos os backends que usam este banco.
--   No Next.js local: .env.local com SUPABASE_SERVICE_ROLE_KEY=... (sem fallback para anon).
--
-- Supabase Advisor: ajuda a limpar "rls_disabled_in_public" e exposição de
-- dados sensíveis via API anônima.
-- ============================================================

DO $$
DECLARE
  -- Acrescente nomes de tabelas que NÃO devem receber RLS neste banco.
  -- PostGIS costuma usar spatial_ref_sys; outras extensões podem criar tabelas em public.
  tabelas_excluidas text[] := ARRAY[
    'spatial_ref_sys'
    -- , 'outra_tabela_referencia'
  ];
  pol RECORD;
  t RECORD;
BEGIN
  -- 1) Dropar TODAS as políticas RLS em tabelas public (exceto excluídas)
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND NOT (tablename = ANY (tabelas_excluidas))
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname,
      pol.schemaname,
      pol.tablename
    );
  END LOOP;

  -- 2) ENABLE ROW LEVEL SECURITY em todas as tabelas base em public
  FOR t IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p') -- heap + tabela particionada (pai)
      AND NOT (c.relname = ANY (tabelas_excluidas))
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      t.tablename
    );
  END LOOP;
END $$;

-- ============================================================
-- Verificação (opcional): tabelas em public com RLS desligado (deve ser vazio,
-- exceto se você excluiu algo de propósito ou tabelas de sistema)
-- ============================================================
-- SELECT c.relname AS tabela, c.relrowsecurity AS rls_ativo
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'r'
-- ORDER BY c.relname;
