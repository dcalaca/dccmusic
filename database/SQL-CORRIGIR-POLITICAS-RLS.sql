-- ============================================
-- SQL PARA CORRIGIR POLÍTICAS RLS
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script garante que todas as políticas de INSERT/UPDATE/DELETE existam
-- Execute este script se você está tendo erros de RLS ao fazer seed
-- ============================================

-- Remover políticas antigas se existirem (para evitar conflitos)
DROP POLICY IF EXISTS "dccmusic_genres permitir insert" ON dccmusic_genres;
DROP POLICY IF EXISTS "dccmusic_genres permitir insert para service role" ON dccmusic_genres;
DROP POLICY IF EXISTS "dccmusic_videos permitir insert" ON dccmusic_videos;
DROP POLICY IF EXISTS "dccmusic_videos permitir insert para service role" ON dccmusic_videos;
DROP POLICY IF EXISTS "dccmusic_musics permitir insert" ON dccmusic_musics;
DROP POLICY IF EXISTS "dccmusic_musics permitir insert para service role" ON dccmusic_musics;
DROP POLICY IF EXISTS "dccmusic_users permitir insert" ON dccmusic_users;
DROP POLICY IF EXISTS "dccmusic_users permitir insert para service role" ON dccmusic_users;

DROP POLICY IF EXISTS "dccmusic_genres permitir update" ON dccmusic_genres;
DROP POLICY IF EXISTS "dccmusic_genres permitir update para service role" ON dccmusic_genres;
DROP POLICY IF EXISTS "dccmusic_videos permitir update" ON dccmusic_videos;
DROP POLICY IF EXISTS "dccmusic_videos permitir update para service role" ON dccmusic_videos;
DROP POLICY IF EXISTS "dccmusic_musics permitir update" ON dccmusic_musics;
DROP POLICY IF EXISTS "dccmusic_musics permitir update para service role" ON dccmusic_musics;
DROP POLICY IF EXISTS "dccmusic_users permitir update" ON dccmusic_users;
DROP POLICY IF EXISTS "dccmusic_users permitir update para service role" ON dccmusic_users;

DROP POLICY IF EXISTS "dccmusic_genres permitir delete" ON dccmusic_genres;
DROP POLICY IF EXISTS "dccmusic_genres permitir delete para service role" ON dccmusic_genres;
DROP POLICY IF EXISTS "dccmusic_videos permitir delete" ON dccmusic_videos;
DROP POLICY IF EXISTS "dccmusic_videos permitir delete para service role" ON dccmusic_videos;
DROP POLICY IF EXISTS "dccmusic_musics permitir delete" ON dccmusic_musics;
DROP POLICY IF EXISTS "dccmusic_musics permitir delete para service role" ON dccmusic_musics;
DROP POLICY IF EXISTS "dccmusic_users permitir delete" ON dccmusic_users;
DROP POLICY IF EXISTS "dccmusic_users permitir delete para service role" ON dccmusic_users;

-- Criar políticas de INSERT (permitir tudo - service role bypassa RLS mesmo assim)
CREATE POLICY "dccmusic_genres permitir insert"
  ON dccmusic_genres FOR INSERT
  WITH CHECK (true);

CREATE POLICY "dccmusic_videos permitir insert"
  ON dccmusic_videos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "dccmusic_musics permitir insert"
  ON dccmusic_musics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "dccmusic_users permitir insert"
  ON dccmusic_users FOR INSERT
  WITH CHECK (true);

-- Criar políticas de UPDATE
CREATE POLICY "dccmusic_genres permitir update"
  ON dccmusic_genres FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "dccmusic_videos permitir update"
  ON dccmusic_videos FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "dccmusic_musics permitir update"
  ON dccmusic_musics FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "dccmusic_users permitir update"
  ON dccmusic_users FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Criar políticas de DELETE
CREATE POLICY "dccmusic_genres permitir delete"
  ON dccmusic_genres FOR DELETE
  USING (true);

CREATE POLICY "dccmusic_videos permitir delete"
  ON dccmusic_videos FOR DELETE
  USING (true);

CREATE POLICY "dccmusic_musics permitir delete"
  ON dccmusic_musics FOR DELETE
  USING (true);

CREATE POLICY "dccmusic_users permitir delete"
  ON dccmusic_users FOR DELETE
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
WHERE tablename LIKE 'dccmusic_%'
ORDER BY tablename, cmd;

-- ============================================
-- NOTA IMPORTANTE:
-- A Service Role Key deveria bypassar RLS automaticamente,
-- mas essas políticas garantem que funcione mesmo se houver
-- algum problema com a configuração do Supabase.
-- ============================================
