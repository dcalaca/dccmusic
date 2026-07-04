-- ============================================
-- SQL PARA CORRIGIR COLUNA GENRE EM MÚSICAS
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script corrige a estrutura da tabela dccmusic_musics
-- para usar genre (TEXT) em vez de genre_id (UUID)
-- ============================================

-- Passo 1: Adicionar coluna genre (texto) se não existir
ALTER TABLE dccmusic_musics 
ADD COLUMN IF NOT EXISTS genre TEXT;

-- Passo 2: Migrar dados existentes de genre_id para genre (se houver dados)
-- Isso só funciona se você ainda tiver a tabela dccmusic_genres com dados
UPDATE dccmusic_musics m
SET genre = g.name
FROM dccmusic_genres g
WHERE m.genre_id = g.id AND (m.genre IS NULL OR m.genre = '');

-- Passo 3: Remover constraint NOT NULL de genre_id (se existir)
ALTER TABLE dccmusic_musics 
ALTER COLUMN genre_id DROP NOT NULL;

-- Passo 4: Remover foreign key constraint (se existir)
ALTER TABLE dccmusic_musics 
DROP CONSTRAINT IF EXISTS dccmusic_musics_genre_id_fkey;

-- Passo 5: Criar índice para melhor performance nas buscas por gênero
CREATE INDEX IF NOT EXISTS idx_dccmusic_musics_genre ON dccmusic_musics(genre)
WHERE genre IS NOT NULL;

-- Passo 6: Verificar estrutura atual
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'dccmusic_musics'
  AND column_name IN ('genre', 'genre_id')
ORDER BY column_name;

-- ============================================
-- NOTA IMPORTANTE:
-- Após executar este script, a tabela terá ambas as colunas
-- (genre e genre_id), mas apenas genre será usada pelo código.
-- Você pode remover genre_id depois se quiser, mas não é obrigatório.
-- ============================================
