-- ============================================
-- SQL PARA CRIAR TABELAS NO SUPABASE
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA: dccmusic_users (Usuários)
-- ============================================
CREATE TABLE IF NOT EXISTS dccmusic_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  email_verified TIMESTAMPTZ,
  image TEXT,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dccmusic_users_email ON dccmusic_users(email);

-- ============================================
-- TABELA: dccmusic_genres (Gêneros)
-- ============================================
CREATE TABLE IF NOT EXISTS dccmusic_genres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dccmusic_genres_slug ON dccmusic_genres(slug);
CREATE INDEX IF NOT EXISTS idx_dccmusic_genres_name ON dccmusic_genres(name);

-- ============================================
-- TABELA: dccmusic_videos (Vídeos)
-- ============================================
CREATE TABLE IF NOT EXISTS dccmusic_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  youtube_url TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  genre_id UUID NOT NULL REFERENCES dccmusic_genres(id) ON DELETE RESTRICT,
  tags TEXT,
  description TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  featured BOOLEAN DEFAULT FALSE,
  thumbnail_url TEXT,
  duration TEXT,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dccmusic_videos_slug ON dccmusic_videos(slug);
CREATE INDEX IF NOT EXISTS idx_dccmusic_videos_genre_id ON dccmusic_videos(genre_id);
CREATE INDEX IF NOT EXISTS idx_dccmusic_videos_published_at ON dccmusic_videos(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_dccmusic_videos_featured ON dccmusic_videos(featured);
CREATE INDEX IF NOT EXISTS idx_dccmusic_videos_view_count ON dccmusic_videos(view_count DESC);

-- ============================================
-- TABELA: dccmusic_musics (Músicas)
-- ============================================
CREATE TABLE IF NOT EXISTS dccmusic_musics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  genre_id UUID NOT NULL REFERENCES dccmusic_genres(id) ON DELETE RESTRICT,
  spotify_url TEXT,
  spotify_embed TEXT,
  apple_music_url TEXT,
  apple_music_embed TEXT,
  tags TEXT,
  description TEXT,
  cover_url TEXT,
  featured BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dccmusic_musics_slug ON dccmusic_musics(slug);
CREATE INDEX IF NOT EXISTS idx_dccmusic_musics_genre_id ON dccmusic_musics(genre_id);
CREATE INDEX IF NOT EXISTS idx_dccmusic_musics_published_at ON dccmusic_musics(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_dccmusic_musics_featured ON dccmusic_musics(featured);

-- ============================================
-- Função para atualizar updated_at automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_dccmusic_users_updated_at BEFORE UPDATE ON dccmusic_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dccmusic_genres_updated_at BEFORE UPDATE ON dccmusic_genres
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dccmusic_videos_updated_at BEFORE UPDATE ON dccmusic_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dccmusic_musics_updated_at BEFORE UPDATE ON dccmusic_musics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS (Row Level Security) - Políticas de Segurança
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE dccmusic_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dccmusic_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE dccmusic_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE dccmusic_musics ENABLE ROW LEVEL SECURITY;

-- Políticas para genres (público pode ler)
CREATE POLICY "dccmusic_genres são públicos para leitura"
  ON dccmusic_genres FOR SELECT
  USING (true);

-- Políticas para videos (público pode ler)
CREATE POLICY "dccmusic_videos são públicos para leitura"
  ON dccmusic_videos FOR SELECT
  USING (true);

-- Políticas para musics (público pode ler)
CREATE POLICY "dccmusic_musics são públicos para leitura"
  ON dccmusic_musics FOR SELECT
  USING (true);

-- Políticas para users (apenas admin pode ver)
CREATE POLICY "dccmusic_users são privados"
  ON dccmusic_users FOR SELECT
  USING (false);

-- Políticas para INSERT/UPDATE/DELETE (para operações via service role)
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
