-- ============================================
-- SQL PARA CORRIGIR RLS DA TABELA dccmusic_genres
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script garante que todas as políticas de INSERT/UPDATE/DELETE existam
-- Execute este script se você está tendo erros de RLS ao criar/editar/deletar gêneros
-- ============================================

-- Remover políticas antigas se existirem (para evitar conflitos)
DROP POLICY IF EXISTS "dccmusic_genres são públicos para leitura" ON dccmusic_genres;
DROP POLICY IF EXISTS "dccmusic_genres permitir insert" ON dccmusic_genres;
DROP POLICY IF EXISTS "dccmusic_genres permitir insert para service role" ON dccmusic_genres;
DROP POLICY IF EXISTS "dccmusic_genres permitir update" ON dccmusic_genres;
DROP POLICY IF EXISTS "dccmusic_genres permitir update para service role" ON dccmusic_genres;
DROP POLICY IF EXISTS "dccmusic_genres permitir delete" ON dccmusic_genres;
DROP POLICY IF EXISTS "dccmusic_genres permitir delete para service role" ON dccmusic_genres;

-- Criar política de SELECT (público pode ler)
CREATE POLICY "dccmusic_genres são públicos para leitura"
  ON dccmusic_genres FOR SELECT
  USING (true);

-- Criar política de INSERT (permitir tudo - service role bypassa RLS mesmo assim)
CREATE POLICY "dccmusic_genres permitir insert"
  ON dccmusic_genres FOR INSERT
  WITH CHECK (true);

-- Criar política de UPDATE
CREATE POLICY "dccmusic_genres permitir update"
  ON dccmusic_genres FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Criar política de DELETE
CREATE POLICY "dccmusic_genres permitir delete"
  ON dccmusic_genres FOR DELETE
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
WHERE tablename = 'dccmusic_genres'
ORDER BY policyname;
