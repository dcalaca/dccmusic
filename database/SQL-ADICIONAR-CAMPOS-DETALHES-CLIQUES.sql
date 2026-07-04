-- ============================================
-- Adicionar campos detalhados para tracking de cliques
-- ============================================
-- Este script adiciona campos para armazenar informações parseadas do User Agent
-- e outras informações detalhadas sobre os cliques

-- Adicionar colunas na tabela dccmusic_link_clicks
ALTER TABLE dccmusic_link_clicks
ADD COLUMN IF NOT EXISTS browser VARCHAR(100),
ADD COLUMN IF NOT EXISTS browser_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS operating_system VARCHAR(100),
ADD COLUMN IF NOT EXISTS os_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50), -- desktop, mobile, tablet, bot, unknown
ADD COLUMN IF NOT EXISTS language VARCHAR(10), -- Idioma do navegador (ex: pt-BR)
ADD COLUMN IF NOT EXISTS query_params TEXT, -- Query parameters da URL (se houver)
ADD COLUMN IF NOT EXISTS region VARCHAR(100); -- Região/estado (se disponível)

-- Criar índices para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_link_clicks_browser ON dccmusic_link_clicks(browser);
CREATE INDEX IF NOT EXISTS idx_link_clicks_device_type ON dccmusic_link_clicks(device_type);
CREATE INDEX IF NOT EXISTS idx_link_clicks_country ON dccmusic_link_clicks(country);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at_desc ON dccmusic_link_clicks(clicked_at DESC);

-- Comentários nas colunas para documentação
COMMENT ON COLUMN dccmusic_link_clicks.browser IS 'Nome do navegador (Chrome, Firefox, Safari, etc.)';
COMMENT ON COLUMN dccmusic_link_clicks.browser_version IS 'Versão do navegador';
COMMENT ON COLUMN dccmusic_link_clicks.operating_system IS 'Sistema operacional (Windows, macOS, Android, iOS, Linux)';
COMMENT ON COLUMN dccmusic_link_clicks.os_version IS 'Versão do sistema operacional';
COMMENT ON COLUMN dccmusic_link_clicks.device_type IS 'Tipo de dispositivo: desktop, mobile, tablet, bot, unknown';
COMMENT ON COLUMN dccmusic_link_clicks.language IS 'Idioma do navegador (ex: pt-BR, en-US)';
COMMENT ON COLUMN dccmusic_link_clicks.query_params IS 'Query parameters da URL do link (se houver)';
COMMENT ON COLUMN dccmusic_link_clicks.region IS 'Região/estado (se disponível via geolocalização)';
