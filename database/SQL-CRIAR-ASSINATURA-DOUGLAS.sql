-- Criar assinatura completa para Douglas Calaça
-- Este SQL cria a assinatura na tabela dccmusic_subscriptions e atualiza o compositor

-- ============================================
-- PASSO 1: Buscar informações do compositor
-- ============================================
-- Execute primeiro para ver o ID:
SELECT id, name, email, is_premium, has_active_subscription, subscription_expires_at 
FROM dccmusic_composers 
WHERE email = 'dcalaca@gmail.com';

-- ============================================
-- PASSO 2: Verificar se existe plano anual
-- ============================================
SELECT id, name, slug FROM dccmusic_plans WHERE slug = 'plano-anual-compositor';

-- Se não existir, criar o plano:
INSERT INTO dccmusic_plans (name, slug, price, duration_months, description, is_active)
VALUES (
  'Plano Anual Compositor',
  'plano-anual-compositor',
  100.00,
  12,
  'Plano anual para compositores - acesso completo ao sistema',
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- PASSO 3: Criar assinatura na tabela
-- ============================================
-- Substitua 'COMPOSER_ID_AQUI' pelo ID retornado no PASSO 1
INSERT INTO dccmusic_subscriptions (
  composer_id,
  plan_id,
  status,
  start_date,
  end_date,
  payment_method,
  payment_id
)
SELECT 
  c.id, -- ID do compositor
  p.id, -- ID do plano anual
  'active',
  NOW(),
  NOW() + INTERVAL '10 years', -- Válido até 2036
  'manual',
  'admin-premium-' || gen_random_uuid()::text
FROM dccmusic_composers c
CROSS JOIN dccmusic_plans p
WHERE c.email = 'dcalaca@gmail.com'
  AND p.slug = 'plano-anual-compositor'
ON CONFLICT DO NOTHING;

-- ============================================
-- PASSO 4: Atualizar compositor como premium
-- ============================================
UPDATE dccmusic_composers
SET 
  is_premium = true,
  has_active_subscription = true,
  subscription_expires_at = NOW() + INTERVAL '10 years'
WHERE email = 'dcalaca@gmail.com';

-- ============================================
-- PASSO 5: Verificar se funcionou
-- ============================================
SELECT 
  c.id,
  c.name,
  c.email,
  c.is_premium,
  c.has_active_subscription,
  c.subscription_expires_at,
  s.id as subscription_id,
  s.status as subscription_status,
  s.start_date,
  s.end_date
FROM dccmusic_composers c
LEFT JOIN dccmusic_subscriptions s ON s.composer_id = c.id AND s.status = 'active'
WHERE c.email = 'dcalaca@gmail.com';
