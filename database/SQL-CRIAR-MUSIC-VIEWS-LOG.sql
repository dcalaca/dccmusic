-- ============================================================
-- CONTADOR + LOG DE VISUALIZAÇÕES DE MÚSICAS
-- ============================================================
-- PASSOS:
-- 1. Supabase → SQL Editor → cole este arquivo e execute
-- 2. Confira: coluna view_count em dccmusic_musics e tabela dccmusic_music_views
-- 3. Abra uma música pública (/musicas/...) e verifique /admin/visualizacoes (aba Músicas)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.dccmusic_musics
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.dccmusic_music_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  music_id UUID NOT NULL REFERENCES public.dccmusic_musics(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(64),
  user_agent TEXT,
  referer TEXT
);

CREATE INDEX IF NOT EXISTS idx_dccmusic_music_views_music_id
  ON public.dccmusic_music_views(music_id);

CREATE INDEX IF NOT EXISTS idx_dccmusic_music_views_viewed_at
  ON public.dccmusic_music_views(viewed_at DESC);

COMMENT ON TABLE public.dccmusic_music_views IS
  'Registro por visualização da página pública de cada música';

-- Gravação/leitura via SUPABASE_SERVICE_ROLE_KEY no app (sem RLS aqui).
