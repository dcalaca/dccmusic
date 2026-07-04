-- Criar tabela de compositores
CREATE TABLE IF NOT EXISTS dccmusic_composers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_dccmusic_composers_name ON dccmusic_composers(name);
CREATE INDEX IF NOT EXISTS idx_dccmusic_composers_slug ON dccmusic_composers(slug);

-- Criar tabela de relacionamento vídeos-compositores (many-to-many)
CREATE TABLE IF NOT EXISTS dccmusic_video_composers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES dccmusic_videos(id) ON DELETE CASCADE,
  composer_id UUID NOT NULL REFERENCES dccmusic_composers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(video_id, composer_id)
);

-- Criar tabela de relacionamento músicas-compositores (many-to-many)
CREATE TABLE IF NOT EXISTS dccmusic_music_composers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  music_id UUID NOT NULL REFERENCES dccmusic_musics(id) ON DELETE CASCADE,
  composer_id UUID NOT NULL REFERENCES dccmusic_composers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(music_id, composer_id)
);

-- Criar índices para tabelas de relacionamento
CREATE INDEX IF NOT EXISTS idx_dccmusic_video_composers_video_id ON dccmusic_video_composers(video_id);
CREATE INDEX IF NOT EXISTS idx_dccmusic_video_composers_composer_id ON dccmusic_video_composers(composer_id);
CREATE INDEX IF NOT EXISTS idx_dccmusic_music_composers_music_id ON dccmusic_music_composers(music_id);
CREATE INDEX IF NOT EXISTS idx_dccmusic_music_composers_composer_id ON dccmusic_music_composers(composer_id);

-- Habilitar RLS
ALTER TABLE dccmusic_composers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dccmusic_video_composers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dccmusic_music_composers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para compositores (leitura pública)
CREATE POLICY "dccmusic_composers são públicos para leitura" ON dccmusic_composers
  FOR SELECT USING (true);

CREATE POLICY "dccmusic_composers permitir insert" ON dccmusic_composers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "dccmusic_composers permitir update" ON dccmusic_composers
  FOR UPDATE USING (true);

-- Políticas RLS para relacionamentos (leitura pública)
CREATE POLICY "dccmusic_video_composers são públicos para leitura" ON dccmusic_video_composers
  FOR SELECT USING (true);

CREATE POLICY "dccmusic_video_composers permitir insert" ON dccmusic_video_composers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "dccmusic_video_composers permitir delete" ON dccmusic_video_composers
  FOR DELETE USING (true);

CREATE POLICY "dccmusic_music_composers são públicos para leitura" ON dccmusic_music_composers
  FOR SELECT USING (true);

CREATE POLICY "dccmusic_music_composers permitir insert" ON dccmusic_music_composers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "dccmusic_music_composers permitir delete" ON dccmusic_music_composers
  FOR DELETE USING (true);

-- Comentários
COMMENT ON TABLE dccmusic_composers IS 'Tabela de compositores de músicas e vídeos';
COMMENT ON TABLE dccmusic_video_composers IS 'Relacionamento many-to-many entre vídeos e compositores';
COMMENT ON TABLE dccmusic_music_composers IS 'Relacionamento many-to-many entre músicas e compositores';
