-- Marcar compositor como premium manualmente
-- Use este SQL para marcar você ou qualquer compositor como premium sem pagamento

-- ============================================
-- OPÇÃO 1: Marcar por email (MAIS FÁCIL)
-- ============================================
-- SUBSTITUA 'seu-email@aqui.com' pelo seu email cadastrado
UPDATE dccmusic_composers
SET 
  is_premium = true,
  has_active_subscription = true,
  subscription_expires_at = NOW() + INTERVAL '10 years' -- 10 anos de premium
WHERE email = 'seu-email@aqui.com'; -- ⚠️ SUBSTITUA pelo seu email

-- ============================================
-- OPÇÃO 2: Criar assinatura manual completa
-- ============================================
-- Primeiro, busque seu ID de compositor:
-- SELECT id, name, email FROM dccmusic_composers WHERE email = 'seu-email@aqui.com';

-- Busque o ID do plano anual:
-- SELECT id FROM dccmusic_plans WHERE slug = 'plano-anual-compositor';

-- Depois, crie a assinatura (substitua os valores):
-- INSERT INTO dccmusic_subscriptions (
--   composer_id,
--   plan_id,
--   status,
--   start_date,
--   end_date,
--   payment_method,
--   payment_id
-- )
-- VALUES (
--   'uuid-do-seu-compositor', -- Cole o ID do compositor aqui
--   (SELECT id FROM dccmusic_plans WHERE slug = 'plano-anual-compositor'), -- ID do plano
--   'active',
--   NOW(),
--   NOW() + INTERVAL '10 years',
--   'manual',
--   'admin-premium-' || gen_random_uuid()::text
-- );

-- ============================================
-- OPÇÃO 3: Marcar por nome
-- ============================================
-- UPDATE dccmusic_composers
-- SET 
--   is_premium = true,
--   has_active_subscription = true,
--   subscription_expires_at = NOW() + INTERVAL '10 years'
-- WHERE name = 'Seu Nome Aqui';

-- ============================================
-- VERIFICAR SE FUNCIONOU
-- ============================================
-- Execute este SELECT para verificar:
-- SELECT 
--   id, 
--   name, 
--   email, 
--   is_premium, 
--   has_active_subscription, 
--   subscription_expires_at 
-- FROM dccmusic_composers 
-- WHERE email = 'seu-email@aqui.com';

-- Opção 2: Marcar por ID (se souber o ID)
-- UPDATE dccmusic_composers
-- SET 
--   is_premium = true,
--   has_active_subscription = true,
--   subscription_expires_at = NOW() + INTERVAL '10 years'
-- WHERE id = 'uuid-do-compositor-aqui';

-- Opção 3: Marcar por nome
-- UPDATE dccmusic_composers
-- SET 
--   is_premium = true,
--   has_active_subscription = true,
--   subscription_expires_at = NOW() + INTERVAL '10 years'
-- WHERE name = 'Nome do Compositor';

-- Opção 4: Criar uma assinatura "manual" para o compositor
-- Primeiro, busque o ID do plano anual:
-- SELECT id FROM dccmusic_plans WHERE slug = 'plano-anual-compositor';

-- Depois, crie a assinatura (substitua os valores):
-- INSERT INTO dccmusic_subscriptions (
--   composer_id,
--   plan_id,
--   status,
--   start_date,
--   end_date,
--   payment_method,
--   payment_id
-- )
-- VALUES (
--   'uuid-do-compositor', -- ID do compositor
--   'uuid-do-plano', -- ID do plano anual
--   'active',
--   NOW(),
--   NOW() + INTERVAL '10 years',
--   'manual',
--   'admin-premium'
-- );

-- Verificar se foi atualizado:
-- SELECT id, name, email, is_premium, has_active_subscription, subscription_expires_at 
-- FROM dccmusic_composers 
-- WHERE email = 'seu-email@aqui.com';
