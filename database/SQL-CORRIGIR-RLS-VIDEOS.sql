-- ============================================
-- SQL PARA CORRIGIR POLÍTICAS RLS - VÍDEOS
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script garante que as políticas RLS permitam INSERT/UPDATE/DELETE
-- para a tabela dccmusic_videos
-- ============================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "dccmusic_videos permitir insert" ON dccmusic_videos;
DROP POLICY IF EXISTS "dccmusic_videos permitir update" ON dccmusic_videos;
DROP POLICY IF EXISTS "dccmusic_videos permitir delete" ON dccmusic_videos;

-- Criar políticas de INSERT (permitir tudo - service role bypassa RLS mesmo assim)
CREATE POLICY "dccmusic_videos permitir insert"
  ON dccmusic_videos FOR INSERT
  WITH CHECK (true);

-- Criar políticas de UPDATE
CREATE POLICY "dccmusic_videos permitir update"
  ON dccmusic_videos FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Criar políticas de DELETE
CREATE POLICY "dccmusic_videos permitir delete"
  ON dccmusic_videos FOR DELETE
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
WHERE tablename = 'dccmusic_videos'
ORDER BY cmd;

-- ============================================
-- NOTA IMPORTANTE:
-- A Service Role Key deveria bypassar RLS automaticamente,
-- mas essas políticas garantem que funcione mesmo se houver
-- algum problema com a configuração do Supabase.
-- ============================================
