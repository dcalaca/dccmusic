-- ============================================
-- SQL PARA ADICIONAR POLÍTICAS DE INSERT
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script adiciona políticas RLS para permitir INSERTs
-- IMPORTANTE: Execute após criar as tabelas
-- ============================================

-- Políticas para INSERT em genres (público pode inserir - ou apenas admin via service role)
-- Como estamos usando service role key no seed, essas políticas são para operações via API
CREATE POLICY "dccmusic_genres permitir insert para service role"
  ON dccmusic_genres FOR INSERT
  WITH CHECK (true);

CREATE POLICY "dccmusic_videos permitir insert para service role"
  ON dccmusic_videos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "dccmusic_musics permitir insert para service role"
  ON dccmusic_musics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "dccmusic_users permitir insert para service role"
  ON dccmusic_users FOR INSERT
  WITH CHECK (true);

-- Políticas para UPDATE
CREATE POLICY "dccmusic_genres permitir update para service role"
  ON dccmusic_genres FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "dccmusic_videos permitir update para service role"
  ON dccmusic_videos FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "dccmusic_musics permitir update para service role"
  ON dccmusic_musics FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "dccmusic_users permitir update para service role"
  ON dccmusic_users FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Políticas para DELETE
CREATE POLICY "dccmusic_genres permitir delete para service role"
  ON dccmusic_genres FOR DELETE
  USING (true);

CREATE POLICY "dccmusic_videos permitir delete para service role"
  ON dccmusic_videos FOR DELETE
  USING (true);

CREATE POLICY "dccmusic_musics permitir delete para service role"
  ON dccmusic_musics FOR DELETE
  USING (true);

CREATE POLICY "dccmusic_users permitir delete para service role"
  ON dccmusic_users FOR DELETE
  USING (true);

-- ============================================
-- NOTA: Service Role Key bypassa RLS automaticamente
-- Mas essas políticas garantem que funcione também via API
-- ============================================
