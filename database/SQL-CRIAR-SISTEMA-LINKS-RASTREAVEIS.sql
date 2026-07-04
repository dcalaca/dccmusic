-- ============================================
-- Sistema de Links Rastreáveis
-- ============================================
-- Este script cria as tabelas necessárias para rastrear cliques em links

-- 1. Tabela de Links Rastreáveis
CREATE TABLE IF NOT EXISTS dccmusic_tracked_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  destination_url TEXT NOT NULL,
  short_code VARCHAR(50) UNIQUE NOT NULL,
  created_by VARCHAR(255), -- Email ou identificador de quem criou
  notes TEXT, -- Notas sobre o link (opcional)
  expires_at TIMESTAMP WITH TIME ZONE, -- Data de expiração (opcional)
  is_active BOOLEAN DEFAULT true,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Cliques Registrados
CREATE TABLE IF NOT EXISTS dccmusic_link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES dccmusic_tracked_links(id) ON DELETE CASCADE,
  ip_address INET, -- Endereço IP de quem clicou
  user_agent TEXT, -- Navegador/dispositivo
  referer TEXT, -- De onde veio o clique
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  country VARCHAR(100), -- País (opcional, pode ser preenchido depois)
  city VARCHAR(100) -- Cidade (opcional)
);

-- 3. Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_tracked_links_short_code ON dccmusic_tracked_links(short_code);
CREATE INDEX IF NOT EXISTS idx_tracked_links_created_by ON dccmusic_tracked_links(created_by);
CREATE INDEX IF NOT EXISTS idx_tracked_links_is_active ON dccmusic_tracked_links(is_active);
CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id ON dccmusic_link_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON dccmusic_link_clicks(clicked_at);

-- 4. Função para atualizar contador de cliques automaticamente
CREATE OR REPLACE FUNCTION update_link_click_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dccmusic_tracked_links
  SET click_count = (
    SELECT COUNT(*) 
    FROM dccmusic_link_clicks 
    WHERE link_id = NEW.link_id
  ),
  updated_at = NOW()
  WHERE id = NEW.link_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para atualizar contador quando um clique é registrado
DROP TRIGGER IF EXISTS trigger_update_link_click_count ON dccmusic_link_clicks;
CREATE TRIGGER trigger_update_link_click_count
AFTER INSERT ON dccmusic_link_clicks
FOR EACH ROW
EXECUTE FUNCTION update_link_click_count();

-- 6. Função para gerar código curto único
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS VARCHAR(50) AS $$
DECLARE
  chars VARCHAR(62) := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result VARCHAR(50) := '';
  i INTEGER;
  char_index INTEGER;
BEGIN
  -- Gerar código de 8 caracteres
  FOR i IN 1..8 LOOP
    char_index := floor(random() * 62)::INTEGER + 1;
    result := result || substr(chars, char_index, 1);
  END LOOP;
  
  -- Verificar se já existe, se sim, gerar outro
  WHILE EXISTS (SELECT 1 FROM dccmusic_tracked_links WHERE short_code = result) LOOP
    result := '';
    FOR i IN 1..8 LOOP
      char_index := floor(random() * 62)::INTEGER + 1;
      result := result || substr(chars, char_index, 1);
    END LOOP;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 7. RLS Policies (Row Level Security)
ALTER TABLE dccmusic_tracked_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE dccmusic_link_clicks ENABLE ROW LEVEL SECURITY;

-- Permitir leitura pública de links ativos
CREATE POLICY "Permitir leitura de links ativos"
ON dccmusic_tracked_links
FOR SELECT
USING (is_active = true);

-- Permitir inserção de cliques (público)
CREATE POLICY "Permitir inserção de cliques"
ON dccmusic_link_clicks
FOR INSERT
WITH CHECK (true);

-- Permitir leitura de cliques apenas para o criador do link
CREATE POLICY "Permitir leitura de cliques do próprio link"
ON dccmusic_link_clicks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM dccmusic_tracked_links 
    WHERE id = link_id 
    AND created_by = current_setting('app.user_email', true)
  )
);

-- Permitir criação de links para usuários autenticados (ajuste conforme sua autenticação)
CREATE POLICY "Permitir criação de links"
ON dccmusic_tracked_links
FOR INSERT
WITH CHECK (true); -- Ajuste conforme sua necessidade de autenticação

-- Permitir atualização de links pelo criador
CREATE POLICY "Permitir atualização de links próprios"
ON dccmusic_tracked_links
FOR UPDATE
USING (created_by = current_setting('app.user_email', true))
WITH CHECK (created_by = current_setting('app.user_email', true));

-- ============================================
-- Exemplos de uso:
-- ============================================
-- Criar um link rastreável:
-- INSERT INTO dccmusic_tracked_links (title, destination_url, short_code, created_by)
-- VALUES ('Link para meu site', 'https://meusite.com', generate_short_code(), 'usuario@email.com');

-- Ver estatísticas de um link:
-- SELECT 
--   tl.*,
--   COUNT(lc.id) as total_cliques,
--   COUNT(DISTINCT lc.ip_address) as cliques_unicos
-- FROM dccmusic_tracked_links tl
-- LEFT JOIN dccmusic_link_clicks lc ON tl.id = lc.link_id
-- WHERE tl.short_code = 'abc12345'
-- GROUP BY tl.id;
