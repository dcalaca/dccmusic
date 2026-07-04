-- ============================================
-- SQL PARA CORRIGIR TABELA dccmusic_musics
-- Garantir que genre funciona corretamente
-- ============================================

-- 1. Verificar estrutura atual
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'dccmusic_musics'
  AND column_name IN ('genre', 'genre_id')
ORDER BY column_name;

-- 2. Verificar constraints
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'dccmusic_musics'
  AND kcu.column_name IN ('genre', 'genre_id')
ORDER BY tc.constraint_type, kcu.column_name;

-- 3. Garantir que a coluna genre existe e é nullable
ALTER TABLE dccmusic_musics 
ADD COLUMN IF NOT EXISTS genre TEXT;

ALTER TABLE dccmusic_musics 
ALTER COLUMN genre DROP NOT NULL;

-- 4. Remover constraint NOT NULL de genre_id se existir
ALTER TABLE dccmusic_musics 
ALTER COLUMN genre_id DROP NOT NULL;

-- 5. Remover foreign key constraint de genre_id se existir
ALTER TABLE dccmusic_musics 
DROP CONSTRAINT IF EXISTS dccmusic_musics_genre_id_fkey;

-- 6. Criar índice para genre se não existir
CREATE INDEX IF NOT EXISTS idx_dccmusic_musics_genre ON dccmusic_musics(genre)
WHERE genre IS NOT NULL;

-- 7. Verificar se há músicas sem genre mas com genre_id
-- (para migração futura se necessário)
SELECT 
  COUNT(*) as total,
  COUNT(genre) as com_genre,
  COUNT(genre_id) as com_genre_id,
  COUNT(*) FILTER (WHERE genre IS NULL AND genre_id IS NOT NULL) as precisa_migrar
FROM dccmusic_musics;

-- 8. Verificar estrutura final
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'dccmusic_musics'
ORDER BY ordinal_position;
