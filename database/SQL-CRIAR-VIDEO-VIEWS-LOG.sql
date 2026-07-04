-- ============================================================
-- LOG DE VISUALIZAÇÕES DE VÍDEOS (Gerenciar Visualizações no admin)
-- ============================================================
-- PASSOS:
-- 1. Supabase → SQL Editor → New query
-- 2. Cole este arquivo INTEIRO e clique em RUN (ou Ctrl+Enter)
-- 3. Confira em Table Editor se apareceu: dccmusic_video_views
-- 4. Se ainda der "schema cache": aguarde ~1 min ou vá em
--    Project Settings → API → salve algo para forçar reload (ou redeploy no Vercel)
-- 5. Abra no site uma página de vídeo (/videos/...) e recarregue /admin/visualizacoes
-- ============================================================

-- UUID (Supabase / Postgres moderno)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.dccmusic_video_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.dccmusic_videos(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(64),
  user_agent TEXT,
  referer TEXT
);

CREATE INDEX IF NOT EXISTS idx_dccmusic_video_views_video_id
  ON public.dccmusic_video_views(video_id);

CREATE INDEX IF NOT EXISTS idx_dccmusic_video_views_viewed_at
  ON public.dccmusic_video_views(viewed_at DESC);

COMMENT ON TABLE public.dccmusic_video_views IS
  'Registro por visualização da página pública de cada vídeo';

-- A leitura/gravação na API do app usa SUPABASE_SERVICE_ROLE_KEY (ignora RLS).
-- Não habilitamos RLS aqui para evitar surpresas; os dados não são expostos no frontend público.
