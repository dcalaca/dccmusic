-- ============================================
-- SQL PARA MIGRAR PARA GÊNEROS DINÂMICOS
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script altera a estrutura para usar gênero como texto livre
-- em vez de foreign key para tabela de gêneros
-- ============================================

-- Passo 1: Adicionar coluna genre (texto) nas tabelas
ALTER TABLE dccmusic_videos 
ADD COLUMN IF NOT EXISTS genre TEXT;

ALTER TABLE dccmusic_musics 
ADD COLUMN IF NOT EXISTS genre TEXT;

-- Passo 2: Migrar dados existentes (se houver genre_id preenchido)
-- Isso só funciona se você ainda tiver a tabela dccmusic_genres
-- Se não tiver, pule este passo
UPDATE dccmusic_videos v
SET genre = g.name
FROM dccmusic_genres g
WHERE v.genre_id = g.id AND v.genre IS NULL;

UPDATE dccmusic_musics m
SET genre = g.name
FROM dccmusic_genres g
WHERE m.genre_id = g.id AND m.genre IS NULL;

-- Passo 3: Tornar genre NOT NULL (opcional - pode deixar NULL se preferir)
-- ALTER TABLE dccmusic_videos ALTER COLUMN genre SET NOT NULL;
-- ALTER TABLE dccmusic_musics ALTER COLUMN genre SET NOT NULL;

-- Passo 4: Remover foreign key constraint (se existir)
ALTER TABLE dccmusic_videos 
DROP CONSTRAINT IF EXISTS dccmusic_videos_genre_id_fkey;

ALTER TABLE dccmusic_musics 
DROP CONSTRAINT IF EXISTS dccmusic_musics_genre_id_fkey;

-- Passo 5: Remover coluna genre_id (opcional - pode manter se quiser histórico)
-- ALTER TABLE dccmusic_videos DROP COLUMN IF EXISTS genre_id;
-- ALTER TABLE dccmusic_musics DROP COLUMN IF EXISTS genre_id;

-- Passo 6: Criar índice para melhor performance nas buscas por gênero
CREATE INDEX IF NOT EXISTS idx_dccmusic_videos_genre ON dccmusic_videos(genre);
CREATE INDEX IF NOT EXISTS idx_dccmusic_musics_genre ON dccmusic_musics(genre);

-- Passo 7: Remover índices antigos relacionados a genre_id (se existirem)
DROP INDEX IF EXISTS idx_dccmusic_videos_genre_id;
DROP INDEX IF EXISTS idx_dccmusic_musics_genre_id;

-- ============================================
-- NOTA: A tabela dccmusic_genres pode ser mantida
-- para histórico ou removida completamente.
-- Para remover completamente:
-- DROP TABLE IF EXISTS dccmusic_genres CASCADE;
-- ============================================
