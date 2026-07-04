-- ============================================
-- Proteção contra robôs nas visualizações de vídeos e músicas
-- ============================================
-- Adiciona campos para classificar cada visualização em:
--   HUMAN_VIEW  -> visualização de pessoa real
--   BOT_PREVIEW -> robô / preview (WhatsApp, Facebook, Google, etc.)
--   UNKNOWN     -> não foi possível determinar
--
-- Registros antigos ficam como 'UNKNOWN' e CONTINUAM contando nos relatórios.
-- Apenas o que for detectado como BOT_PREVIEW deixa de contar.
-- É seguro rodar este script mais de uma vez (usa IF NOT EXISTS).

-- ---------- Vídeos ----------
ALTER TABLE dccmusic_video_views
  ADD COLUMN IF NOT EXISTS view_type VARCHAR(20) DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS classification_reason TEXT,
  ADD COLUMN IF NOT EXISTS inferred_source VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_video_views_view_type
  ON dccmusic_video_views(view_type);

CREATE INDEX IF NOT EXISTS idx_video_views_viewed_at_type
  ON dccmusic_video_views(viewed_at DESC, view_type);

-- ---------- Músicas ----------
ALTER TABLE dccmusic_music_views
  ADD COLUMN IF NOT EXISTS view_type VARCHAR(20) DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS classification_reason TEXT,
  ADD COLUMN IF NOT EXISTS inferred_source VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_music_views_view_type
  ON dccmusic_music_views(view_type);

CREATE INDEX IF NOT EXISTS idx_music_views_viewed_at_type
  ON dccmusic_music_views(viewed_at DESC, view_type);

-- Comentários (documentação)
COMMENT ON COLUMN dccmusic_video_views.view_type IS 'HUMAN_VIEW (pessoa real), BOT_PREVIEW (robô/preview), UNKNOWN (indeterminado)';
COMMENT ON COLUMN dccmusic_music_views.view_type IS 'HUMAN_VIEW (pessoa real), BOT_PREVIEW (robô/preview), UNKNOWN (indeterminado)';
