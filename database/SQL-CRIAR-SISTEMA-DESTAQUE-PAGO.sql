-- ============================================
-- Sistema de Destaque Pago
-- ============================================
-- Este script cria a tabela para controlar destaques pagos
-- com expiração automática (10 dias)

-- Tabela de Destaques Pagos
CREATE TABLE IF NOT EXISTS dccmusic_featured_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('music', 'video')),
  content_id UUID NOT NULL, -- ID da música ou vídeo
  composer_id UUID NOT NULL REFERENCES dccmusic_composers(id) ON DELETE CASCADE,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'approved', 'rejected', 'cancelled')),
  mercado_pago_preference_id TEXT, -- ID da preferência do Mercado Pago
  mercado_pago_payment_id TEXT, -- ID do pagamento quando aprovado
  amount DECIMAL(10, 2) NOT NULL DEFAULT 9.90, -- Valor pago
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Data de expiração (10 dias após pagamento)
  is_active BOOLEAN DEFAULT false, -- Ativo apenas se pago e não expirado
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para featured_payments
CREATE INDEX IF NOT EXISTS idx_featured_payments_content ON dccmusic_featured_payments(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_featured_payments_composer ON dccmusic_featured_payments(composer_id);
CREATE INDEX IF NOT EXISTS idx_featured_payments_status ON dccmusic_featured_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_featured_payments_active ON dccmusic_featured_payments(is_active);
CREATE INDEX IF NOT EXISTS idx_featured_payments_expires ON dccmusic_featured_payments(expires_at);
CREATE INDEX IF NOT EXISTS idx_featured_payments_preference ON dccmusic_featured_payments(mercado_pago_preference_id);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_featured_payments_updated_at ON dccmusic_featured_payments;
CREATE TRIGGER update_featured_payments_updated_at
  BEFORE UPDATE ON dccmusic_featured_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para verificar e atualizar status de destaques expirados
CREATE OR REPLACE FUNCTION check_expired_featured()
RETURNS void AS $$
BEGIN
  -- Desativar destaques expirados
  UPDATE dccmusic_featured_payments
  SET is_active = false
  WHERE is_active = true
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Função para ativar destaque quando pagamento é aprovado
CREATE OR REPLACE FUNCTION activate_featured_payment(
  p_preference_id TEXT,
  p_payment_id TEXT
)
RETURNS void AS $$
DECLARE
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calcular data de expiração (10 dias a partir de agora)
  v_expires_at := NOW() + INTERVAL '10 days';
  
  -- Atualizar pagamento para aprovado e ativo
  UPDATE dccmusic_featured_payments
  SET 
    payment_status = 'approved',
    mercado_pago_payment_id = p_payment_id,
    is_active = true,
    expires_at = v_expires_at,
    updated_at = NOW()
  WHERE mercado_pago_preference_id = p_preference_id
    AND payment_status = 'pending';
  
  -- Atualizar campo featured na tabela de conteúdo
  -- Isso será feito via trigger ou função separada
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar campo featured quando destaque é ativado/desativado
CREATE OR REPLACE FUNCTION sync_featured_field()
RETURNS TRIGGER AS $$
BEGIN
  -- Se destaque foi ativado, marcar conteúdo como featured
  IF NEW.is_active = true AND (OLD.is_active = false OR OLD IS NULL) THEN
    IF NEW.content_type = 'music' THEN
      UPDATE dccmusic_musics
      SET featured = true
      WHERE id = NEW.content_id;
    ELSIF NEW.content_type = 'video' THEN
      UPDATE dccmusic_videos
      SET featured = true
      WHERE id = NEW.content_id;
    END IF;
  END IF;
  
  -- Se destaque foi desativado, verificar se há outros destaques ativos
  IF NEW.is_active = false AND OLD.is_active = true THEN
    -- Verificar se há outros destaques ativos para este conteúdo
    IF NOT EXISTS (
      SELECT 1 FROM dccmusic_featured_payments
      WHERE content_type = NEW.content_type
        AND content_id = NEW.content_id
        AND is_active = true
        AND id != NEW.id
    ) THEN
      -- Se não há outros destaques ativos, desmarcar featured
      IF NEW.content_type = 'music' THEN
        UPDATE dccmusic_musics
        SET featured = false
        WHERE id = NEW.content_id;
      ELSIF NEW.content_type = 'video' THEN
        UPDATE dccmusic_videos
        SET featured = false
        WHERE id = NEW.content_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_featured_on_payment_change ON dccmusic_featured_payments;
CREATE TRIGGER sync_featured_on_payment_change
  AFTER INSERT OR UPDATE OF is_active ON dccmusic_featured_payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_featured_field();

-- Comentários
COMMENT ON TABLE dccmusic_featured_payments IS 'Controle de destaques pagos para músicas e vídeos';
COMMENT ON COLUMN dccmusic_featured_payments.content_type IS 'Tipo de conteúdo: music ou video';
COMMENT ON COLUMN dccmusic_featured_payments.content_id IS 'ID da música ou vídeo';
COMMENT ON COLUMN dccmusic_featured_payments.expires_at IS 'Data de expiração do destaque (10 dias após pagamento)';
COMMENT ON COLUMN dccmusic_featured_payments.is_active IS 'True apenas se pagamento aprovado e não expirado';
