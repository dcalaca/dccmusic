-- ============================================
-- Adicionar campos para detecção de bots e geolocalização
-- ============================================
-- Este script adiciona campos para classificar cliques em BOT_PREVIEW, HUMAN_CLICK, UNKNOWN
-- e armazena informações de geolocalização e origem inferida

-- Adicionar colunas na tabela dccmusic_link_clicks
ALTER TABLE dccmusic_link_clicks
ADD COLUMN IF NOT EXISTS click_type VARCHAR(20) DEFAULT 'UNKNOWN', -- BOT_PREVIEW, HUMAN_CLICK, UNKNOWN
ADD COLUMN IF NOT EXISTS classification_reason TEXT, -- Motivo da classificação
ADD COLUMN IF NOT EXISTS inferred_source VARCHAR(100), -- Origem inferida (WhatsApp, Facebook, etc.)
ADD COLUMN IF NOT EXISTS related_preview_id UUID REFERENCES dccmusic_link_clicks(id) ON DELETE SET NULL, -- ID do preview relacionado (se houver)
ADD COLUMN IF NOT EXISTS asn VARCHAR(50), -- ASN (Autonomous System Number)
ADD COLUMN IF NOT EXISTS isp VARCHAR(255), -- ISP (Internet Service Provider)
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8), -- Latitude (opcional)
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8), -- Longitude (opcional)
ADD COLUMN IF NOT EXISTS ip_masked VARCHAR(50); -- IP mascarado para privacidade (ex: 192.168.1.0/24)

-- Criar índices para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_link_clicks_click_type ON dccmusic_link_clicks(click_type);
CREATE INDEX IF NOT EXISTS idx_link_clicks_inferred_source ON dccmusic_link_clicks(inferred_source);
CREATE INDEX IF NOT EXISTS idx_link_clicks_related_preview ON dccmusic_link_clicks(related_preview_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_country ON dccmusic_link_clicks(country);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at_type ON dccmusic_link_clicks(clicked_at DESC, click_type);

-- Adicionar constraint para garantir valores válidos de click_type
ALTER TABLE dccmusic_link_clicks
ADD CONSTRAINT check_click_type CHECK (click_type IN ('BOT_PREVIEW', 'HUMAN_CLICK', 'UNKNOWN'));

-- Comentários nas colunas para documentação
COMMENT ON COLUMN dccmusic_link_clicks.click_type IS 'Tipo de clique: BOT_PREVIEW (preview/crawler), HUMAN_CLICK (clique real), UNKNOWN (não determinado)';
COMMENT ON COLUMN dccmusic_link_clicks.classification_reason IS 'Motivo da classificação (ex: "User-Agent contém padrão de bot: facebookexternalhit")';
COMMENT ON COLUMN dccmusic_link_clicks.inferred_source IS 'Origem inferida baseada em User-Agent e referrer (ex: WhatsApp, Facebook, Instagram)';
COMMENT ON COLUMN dccmusic_link_clicks.related_preview_id IS 'ID do preview relacionado quando há sequência preview -> clique humano';
COMMENT ON COLUMN dccmusic_link_clicks.asn IS 'ASN (Autonomous System Number) do IP';
COMMENT ON COLUMN dccmusic_link_clicks.isp IS 'ISP (Internet Service Provider) do IP';
COMMENT ON COLUMN dccmusic_link_clicks.latitude IS 'Latitude aproximada do IP (para relatórios, não precisa ser exata)';
COMMENT ON COLUMN dccmusic_link_clicks.longitude IS 'Longitude aproximada do IP (para relatórios, não precisa ser exata)';
COMMENT ON COLUMN dccmusic_link_clicks.ip_masked IS 'IP mascarado para privacidade (ex: 192.168.1.0/24) conforme LGPD';

-- Criar função para atualizar contador de cliques humanos apenas
CREATE OR REPLACE FUNCTION update_human_click_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dccmusic_tracked_links
  SET click_count = (
    SELECT COUNT(*) 
    FROM dccmusic_link_clicks 
    WHERE link_id = NEW.link_id
    AND click_type = 'HUMAN_CLICK'
  ),
  updated_at = NOW()
  WHERE id = NEW.link_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar contador apenas para cliques humanos
-- (Manter o trigger antigo também para compatibilidade, mas vamos usar este)
DROP TRIGGER IF EXISTS trigger_update_human_click_count ON dccmusic_link_clicks;
CREATE TRIGGER trigger_update_human_click_count
AFTER INSERT ON dccmusic_link_clicks
FOR EACH ROW
WHEN (NEW.click_type = 'HUMAN_CLICK')
EXECUTE FUNCTION update_human_click_count();

-- Atualizar registros existentes para classificar como UNKNOWN (será atualizado gradualmente)
-- Você pode executar uma query separada depois para reclassificar baseado em user_agent
UPDATE dccmusic_link_clicks
SET click_type = 'UNKNOWN',
    classification_reason = 'Migração: classificação pendente'
WHERE click_type IS NULL OR click_type = '';

-- Criar view para estatísticas de cliques humanos
CREATE OR REPLACE VIEW dccmusic_human_clicks_stats AS
SELECT 
  link_id,
  COUNT(*) FILTER (WHERE click_type = 'HUMAN_CLICK') as human_clicks,
  COUNT(*) FILTER (WHERE click_type = 'BOT_PREVIEW') as bot_previews,
  COUNT(*) FILTER (WHERE click_type = 'UNKNOWN') as unknown_clicks,
  COUNT(DISTINCT ip_address) FILTER (WHERE click_type = 'HUMAN_CLICK') as unique_human_clicks,
  COUNT(*) as total_hits
FROM dccmusic_link_clicks
GROUP BY link_id;
