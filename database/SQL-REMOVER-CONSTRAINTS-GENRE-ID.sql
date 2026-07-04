-- ============================================
-- SQL PARA REMOVER CONSTRAINTS DE genre_id
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script remove todas as constraints e triggers relacionados a genre_id
-- para garantir que apenas a coluna genre seja usada
-- ============================================

-- ============================================
-- VÍDEOS (dccmusic_videos)
-- ============================================

-- Remover foreign key constraint (se existir)
ALTER TABLE dccmusic_videos 
DROP CONSTRAINT IF EXISTS dccmusic_videos_genre_id_fkey;

-- Remover constraint NOT NULL (se ainda existir)
ALTER TABLE dccmusic_videos 
ALTER COLUMN genre_id DROP NOT NULL;

-- Remover constraint DEFAULT (se existir)
ALTER TABLE dccmusic_videos 
ALTER COLUMN genre_id DROP DEFAULT;

-- Remover triggers relacionados a genre_id (se existirem)
DROP TRIGGER IF EXISTS trigger_dccmusic_videos_genre_id ON dccmusic_videos;
DROP TRIGGER IF EXISTS trigger_dccmusic_videos_set_genre_id ON dccmusic_videos;

-- Garantir que a coluna genre existe e é nullable
ALTER TABLE dccmusic_videos 
ADD COLUMN IF NOT EXISTS genre TEXT;

ALTER TABLE dccmusic_videos 
ALTER COLUMN genre DROP NOT NULL;

-- ============================================
-- MÚSICAS (dccmusic_musics)
-- ============================================

-- Remover foreign key constraint (se existir)
ALTER TABLE dccmusic_musics 
DROP CONSTRAINT IF EXISTS dccmusic_musics_genre_id_fkey;

-- Remover constraint NOT NULL (se ainda existir)
ALTER TABLE dccmusic_musics 
ALTER COLUMN genre_id DROP NOT NULL;

-- Remover constraint DEFAULT (se existir)
ALTER TABLE dccmusic_musics 
ALTER COLUMN genre_id DROP DEFAULT;

-- Remover triggers relacionados a genre_id (se existirem)
DROP TRIGGER IF EXISTS trigger_dccmusic_musics_genre_id ON dccmusic_musics;
DROP TRIGGER IF EXISTS trigger_dccmusic_musics_set_genre_id ON dccmusic_musics;

-- Garantir que a coluna genre existe e é nullable
ALTER TABLE dccmusic_musics 
ADD COLUMN IF NOT EXISTS genre TEXT;

ALTER TABLE dccmusic_musics 
ALTER COLUMN genre DROP NOT NULL;

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================

-- Verificar constraints restantes em genre_id
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('dccmusic_videos', 'dccmusic_musics')
  AND kcu.column_name = 'genre_id';

-- Verificar estrutura das colunas
SELECT 
  table_name,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name IN ('dccmusic_videos', 'dccmusic_musics')
  AND column_name IN ('genre', 'genre_id')
ORDER BY table_name, column_name;

-- ============================================
-- NOTA IMPORTANTE:
-- Após executar este script, a coluna genre_id
-- ficará completamente livre de constraints,
-- permitindo valores NULL sem problemas.
-- ============================================
