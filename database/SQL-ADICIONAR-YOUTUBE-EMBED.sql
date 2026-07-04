-- ============================================
-- SQL PARA ADICIONAR CAMPO youtube_embed
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================
-- Este script adiciona o campo youtube_embed na tabela dccmusic_videos
-- ============================================

-- Adicionar coluna youtube_embed
ALTER TABLE dccmusic_videos
ADD COLUMN IF NOT EXISTS youtube_embed TEXT;

-- Criar índice (opcional, mas útil para buscas)
CREATE INDEX IF NOT EXISTS idx_dccmusic_videos_youtube_embed ON dccmusic_videos(youtube_embed)
WHERE youtube_embed IS NOT NULL;

-- Comentário na coluna
COMMENT ON COLUMN dccmusic_videos.youtube_embed IS 'Código iframe completo do YouTube para embed customizado';
