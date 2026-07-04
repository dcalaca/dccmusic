-- ============================================
-- SOLUÇÃO DEFINITIVA: Forçar RLS para permitir INSERT/UPDATE
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. Desabilitar RLS temporariamente para recriar políticas
ALTER TABLE dccmusic_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE dccmusic_payments DISABLE ROW LEVEL SECURITY;

-- 2. Remover TODAS as políticas existentes
DROP POLICY IF EXISTS "Assinaturas ativas são públicas" ON dccmusic_subscriptions;
DROP POLICY IF EXISTS "Compositor pode ver seus pagamentos" ON dccmusic_subscriptions;
DROP POLICY IF EXISTS "Permitir insert assinaturas" ON dccmusic_subscriptions;
DROP POLICY IF EXISTS "Permitir update assinaturas" ON dccmusic_subscriptions;
DROP POLICY IF EXISTS "Compositor pode ver seus pagamentos" ON dccmusic_payments;
DROP POLICY IF EXISTS "Permitir insert pagamentos" ON dccmusic_payments;
DROP POLICY IF EXISTS "Permitir update pagamentos" ON dccmusic_payments;

-- 3. Reabilitar RLS
ALTER TABLE dccmusic_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dccmusic_payments ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas permissivas para SELECT (público pode ver assinaturas ativas)
CREATE POLICY "Assinaturas ativas são públicas" ON dccmusic_subscriptions
  FOR SELECT USING (status = 'active');

-- 5. Criar políticas PERMISSIVAS para INSERT (permite qualquer INSERT)
CREATE POLICY "Permitir insert assinaturas" ON dccmusic_subscriptions
  FOR INSERT WITH CHECK (true);

-- 6. Criar políticas PERMISSIVAS para UPDATE (permite qualquer UPDATE)
CREATE POLICY "Permitir update assinaturas" ON dccmusic_subscriptions
  FOR UPDATE USING (true) WITH CHECK (true);

-- 7. Criar políticas para PAGAMENTOS
CREATE POLICY "Permitir insert pagamentos" ON dccmusic_payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir update pagamentos" ON dccmusic_payments
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Compositor pode ver seus pagamentos" ON dccmusic_payments
  FOR SELECT USING (true);

-- ============================================
-- VERIFICAR SE FUNCIONOU
-- ============================================
-- Execute este SELECT para verificar as políticas:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies 
-- WHERE tablename IN ('dccmusic_subscriptions', 'dccmusic_payments')
-- ORDER BY tablename, policyname;
