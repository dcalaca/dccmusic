-- ============================================
-- Sistema de Avaliações e Comentários
-- ============================================
-- Este script cria as tabelas necessárias para usuários normais,
-- avaliações (ratings) e comentários de músicas e vídeos

-- 1. Tabela de Usuários do Site (usuários normais, não admin)
CREATE TABLE IF NOT EXISTS dccmusic_site_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT, -- Primeiro nome (para exibir nos comentários)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para site_users
CREATE INDEX IF NOT EXISTS idx_site_users_email ON dccmusic_site_users(email);
CREATE INDEX IF NOT EXISTS idx_site_users_is_active ON dccmusic_site_users(is_active);

-- 2. Tabela de Avaliações (Ratings) - para músicas e vídeos
CREATE TABLE IF NOT EXISTS dccmusic_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dccmusic_site_users(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('music', 'video')),
  content_id UUID NOT NULL, -- ID da música ou vídeo
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_type, content_id) -- Um usuário só pode avaliar uma vez cada conteúdo
);

-- Índices para ratings
CREATE INDEX IF NOT EXISTS idx_ratings_content ON dccmusic_ratings(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user ON dccmusic_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON dccmusic_ratings(created_at DESC);

-- 3. Tabela de Comentários - para músicas e vídeos
CREATE TABLE IF NOT EXISTS dccmusic_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dccmusic_site_users(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('music', 'video')),
  content_id UUID NOT NULL, -- ID da música ou vídeo
  comment TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT true, -- Para moderação futura
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para comments
CREATE INDEX IF NOT EXISTS idx_comments_content ON dccmusic_comments(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON dccmusic_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON dccmusic_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_is_approved ON dccmusic_comments(is_approved);

-- 4. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_site_users_updated_at
  BEFORE UPDATE ON dccmusic_site_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ratings_updated_at
  BEFORE UPDATE ON dccmusic_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON dccmusic_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Função para extrair primeiro nome do nome completo
CREATE OR REPLACE FUNCTION get_first_name(full_name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF full_name IS NULL OR full_name = '' THEN
    RETURN '';
  END IF;
  RETURN SPLIT_PART(TRIM(full_name), ' ', 1);
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para atualizar first_name automaticamente quando name mudar
CREATE OR REPLACE FUNCTION update_first_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.first_name = get_first_name(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_site_users_first_name
  BEFORE INSERT OR UPDATE OF name ON dccmusic_site_users
  FOR EACH ROW
  EXECUTE FUNCTION update_first_name();

-- Comentários nas tabelas
COMMENT ON TABLE dccmusic_site_users IS 'Usuários normais do site (não admin/compositores)';
COMMENT ON TABLE dccmusic_ratings IS 'Avaliações de 1 a 5 estrelas para músicas e vídeos';
COMMENT ON TABLE dccmusic_comments IS 'Comentários de usuários em músicas e vídeos';
COMMENT ON COLUMN dccmusic_site_users.first_name IS 'Primeiro nome extraído automaticamente do nome completo';
COMMENT ON COLUMN dccmusic_ratings.content_type IS 'Tipo de conteúdo: music ou video';
COMMENT ON COLUMN dccmusic_ratings.content_id IS 'ID da música ou vídeo';
COMMENT ON COLUMN dccmusic_comments.content_type IS 'Tipo de conteúdo: music ou video';
COMMENT ON COLUMN dccmusic_comments.content_id IS 'ID da música ou vídeo';
