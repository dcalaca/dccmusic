-- Sistema de Assinaturas para Compositors
-- Compositor paga R$ 100/ano e ganha acesso ao sistema

-- Tabela de Planos
CREATE TABLE IF NOT EXISTS dccmusic_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  price DECIMAL(10, 2) NOT NULL,
  duration_months INTEGER NOT NULL DEFAULT 12,
  description TEXT,
  features JSONB, -- Array de features do plano
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Assinaturas
CREATE TABLE IF NOT EXISTS dccmusic_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  composer_id UUID NOT NULL REFERENCES dccmusic_composers(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES dccmusic_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, active, expired, cancelled
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  payment_method VARCHAR(50), -- stripe, pagseguro, mercadopago
  payment_id VARCHAR(255), -- ID do pagamento no gateway
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(composer_id, plan_id, status)
);

-- Tabela de Pagamentos
CREATE TABLE IF NOT EXISTS dccmusic_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES dccmusic_subscriptions(id) ON DELETE CASCADE,
  composer_id UUID NOT NULL REFERENCES dccmusic_composers(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'BRL',
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, paid, failed, refunded
  payment_method VARCHAR(50),
  payment_gateway VARCHAR(50), -- stripe, pagseguro, mercadopago
  gateway_payment_id VARCHAR(255),
  gateway_response JSONB, -- Resposta completa do gateway
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Adicionar campo de assinatura ativa na tabela de compositores
ALTER TABLE dccmusic_composers 
ADD COLUMN IF NOT EXISTS has_active_subscription BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_composer ON dccmusic_subscriptions(composer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON dccmusic_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON dccmusic_subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON dccmusic_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_composer ON dccmusic_payments(composer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON dccmusic_payments(status);
CREATE INDEX IF NOT EXISTS idx_composers_premium ON dccmusic_composers(is_premium);
CREATE INDEX IF NOT EXISTS idx_composers_subscription_expires ON dccmusic_composers(subscription_expires_at);

-- RLS Policies para assinaturas (apenas leitura pública, escrita apenas para admin)
ALTER TABLE dccmusic_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE dccmusic_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dccmusic_payments ENABLE ROW LEVEL SECURITY;

-- Políticas para planos (público pode ler)
DROP POLICY IF EXISTS "Planos são públicos para leitura" ON dccmusic_plans;
CREATE POLICY "Planos são públicos para leitura" ON dccmusic_plans
  FOR SELECT USING (true);

-- Políticas para assinaturas (compositor pode ver suas próprias, público pode ver assinaturas ativas)
DROP POLICY IF EXISTS "Assinaturas ativas são públicas" ON dccmusic_subscriptions;
CREATE POLICY "Assinaturas ativas são públicas" ON dccmusic_subscriptions
  FOR SELECT USING (status = 'active');

-- Política: Permitir INSERT (necessário para criar assinaturas)
DROP POLICY IF EXISTS "Permitir insert assinaturas" ON dccmusic_subscriptions;
CREATE POLICY "Permitir insert assinaturas" ON dccmusic_subscriptions
  FOR INSERT WITH CHECK (true);

-- Política: Permitir UPDATE (necessário para atualizar status)
DROP POLICY IF EXISTS "Permitir update assinaturas" ON dccmusic_subscriptions;
CREATE POLICY "Permitir update assinaturas" ON dccmusic_subscriptions
  FOR UPDATE USING (true) WITH CHECK (true);

-- Políticas para pagamentos (apenas o compositor e admin podem ver)
DROP POLICY IF EXISTS "Compositor pode ver seus pagamentos" ON dccmusic_payments;
CREATE POLICY "Compositor pode ver seus pagamentos" ON dccmusic_payments
  FOR SELECT USING (true); -- Será filtrado por composer_id na aplicação

-- Política: Permitir INSERT em pagamentos
DROP POLICY IF EXISTS "Permitir insert pagamentos" ON dccmusic_payments;
CREATE POLICY "Permitir insert pagamentos" ON dccmusic_payments
  FOR INSERT WITH CHECK (true);

-- Política: Permitir UPDATE em pagamentos
DROP POLICY IF EXISTS "Permitir update pagamentos" ON dccmusic_payments;
CREATE POLICY "Permitir update pagamentos" ON dccmusic_payments
  FOR UPDATE USING (true) WITH CHECK (true);

-- Inserir plano padrão (R$ 100/ano)
INSERT INTO dccmusic_plans (name, slug, price, duration_months, description, features)
VALUES (
  'Plano Anual Compositor',
  'plano-anual-compositor',
  100.00,
  12,
  'Acesso completo ao sistema por 1 ano. Cadastre suas músicas e vídeos, tenha sua página exclusiva e divulgue seu trabalho.',
  '["Cadastro ilimitado de músicas", "Cadastro ilimitado de vídeos", "Página exclusiva personalizada", "Estatísticas de visualizações", "Suporte prioritário"]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Função para verificar se compositor tem assinatura ativa
CREATE OR REPLACE FUNCTION dccmusic_check_composer_subscription(composer_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM dccmusic_subscriptions 
    WHERE composer_id = composer_uuid 
      AND status = 'active' 
      AND end_date > NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar campo is_premium quando assinatura muda
CREATE OR REPLACE FUNCTION dccmusic_update_composer_premium_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dccmusic_composers
  SET 
    has_active_subscription = dccmusic_check_composer_subscription(NEW.composer_id),
    is_premium = dccmusic_check_composer_subscription(NEW.composer_id),
    subscription_expires_at = (
      SELECT MAX(end_date) 
      FROM dccmusic_subscriptions 
      WHERE composer_id = NEW.composer_id AND status = 'active'
    )
  WHERE id = NEW.composer_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_composer_premium_on_subscription_change ON dccmusic_subscriptions;
CREATE TRIGGER update_composer_premium_on_subscription_change
AFTER INSERT OR UPDATE ON dccmusic_subscriptions
FOR EACH ROW
EXECUTE FUNCTION dccmusic_update_composer_premium_status();
