-- ============================================
-- SQL PARA ADICIONAR POLÍTICAS RLS PARA PLANOS
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script adiciona políticas RLS para permitir INSERT/UPDATE/DELETE
-- na tabela dccmusic_plans
-- ============================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Planos permitir insert" ON dccmusic_plans;
DROP POLICY IF EXISTS "Planos permitir update" ON dccmusic_plans;
DROP POLICY IF EXISTS "Planos permitir delete" ON dccmusic_plans;

-- Criar política de INSERT (permitir tudo - service role bypassa RLS mesmo assim)
CREATE POLICY "Planos permitir insert"
  ON dccmusic_plans FOR INSERT
  WITH CHECK (true);

-- Criar política de UPDATE
CREATE POLICY "Planos permitir update"
  ON dccmusic_plans FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Criar política de DELETE
CREATE POLICY "Planos permitir delete"
  ON dccmusic_plans FOR DELETE
  USING (true);

-- Verificar políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'dccmusic_plans'
ORDER BY cmd;

-- ============================================
-- NOTA IMPORTANTE:
-- A Service Role Key deveria bypassar RLS automaticamente,
-- mas essas políticas garantem que funcione mesmo se houver
-- algum problema com a configuração do Supabase.
-- ============================================
