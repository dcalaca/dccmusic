-- ============================================
-- SQL PARA ASSOCIAR PLANO OURO A UM COMPOSITOR
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script cria uma assinatura ativa associando um compositor ao plano Ouro
-- ============================================

-- PASSO 1: Verificar se existe plano Ouro (ou criar se não existir)
-- Primeiro, vamos verificar se já existe um plano com as vantagens Ouro
DO $$
DECLARE
  v_plano_ouro_id UUID;
  v_composer_id UUID;
  v_start_date TIMESTAMP;
  v_end_date TIMESTAMP;
BEGIN
  -- Buscar ou criar plano Ouro
  SELECT id INTO v_plano_ouro_id
  FROM dccmusic_plans
  WHERE slug = 'plano-ouro' OR name ILIKE '%ouro%'
  LIMIT 1;

  -- Se não encontrou, criar o plano Ouro
  IF v_plano_ouro_id IS NULL THEN
    INSERT INTO dccmusic_plans (
      name,
      slug,
      price,
      duration_months,
      description,
      features,
      featured_musics_per_month,
      has_priority_featured,
      has_gold_badge,
      has_premium_layout,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      'Plano Ouro',
      'plano-ouro',
      199.00, -- Ajuste o preço conforme necessário
      12,
      'Plano premium com vantagens exclusivas: 5 destaques grátis por mês, prioridade máxima nos destaques, selo Artista Ouro e layout premium.',
      ARRAY[
        '5 músicas em destaque grátis por mês',
        'Destaques com prioridade máxima na plataforma',
        'Selo "Artista Ouro" no perfil',
        'Página exclusiva com layout premium',
        'Cadastro ilimitado de músicas',
        'Cadastro ilimitado de vídeos'
      ],
      5, -- 5 destaques por mês
      true, -- has_priority_featured
      true, -- has_gold_badge
      true, -- has_premium_layout
      true, -- is_active
      NOW(),
      NOW()
    )
    RETURNING id INTO v_plano_ouro_id;
    
    RAISE NOTICE 'Plano Ouro criado com ID: %', v_plano_ouro_id;
  ELSE
    RAISE NOTICE 'Plano Ouro encontrado com ID: %', v_plano_ouro_id;
    
    -- Atualizar o plano existente para garantir que tem todas as vantagens
    UPDATE dccmusic_plans
    SET
      featured_musics_per_month = 5,
      has_priority_featured = true,
      has_gold_badge = true,
      has_premium_layout = true,
      updated_at = NOW()
    WHERE id = v_plano_ouro_id;
    
    RAISE NOTICE 'Plano Ouro atualizado com todas as vantagens';
  END IF;

  -- PASSO 2: Buscar compositor (ajuste o email ou nome conforme necessário)
  SELECT id INTO v_composer_id
  FROM dccmusic_composers
  WHERE email = 'dcalaca@gmail.com' OR name ILIKE 'Douglas Calac%'
  LIMIT 1;

  IF v_composer_id IS NULL THEN
    RAISE EXCEPTION 'Compositor não encontrado! Verifique o email ou nome.';
  END IF;

  RAISE NOTICE 'Compositor encontrado: ID = %', v_composer_id;

  -- PASSO 3: Criar ou atualizar assinatura
  v_start_date := NOW();
  v_end_date := NOW() + INTERVAL '10 years'; -- Válido por 10 anos para testes

  -- Verificar se já existe assinatura ativa
  IF EXISTS (
    SELECT 1 FROM dccmusic_subscriptions
    WHERE composer_id = v_composer_id
      AND plan_id = v_plano_ouro_id
      AND status = 'active'
  ) THEN
    -- Atualizar assinatura existente
    UPDATE dccmusic_subscriptions
    SET
      status = 'active',
      start_date = v_start_date,
      end_date = v_end_date,
      updated_at = NOW()
    WHERE composer_id = v_composer_id
      AND plan_id = v_plano_ouro_id;
    
    RAISE NOTICE 'Assinatura atualizada com sucesso';
  ELSE
    -- Criar nova assinatura
    INSERT INTO dccmusic_subscriptions (
      composer_id,
      plan_id,
      status,
      start_date,
      end_date,
      payment_method,
      payment_id,
      created_at,
      updated_at
    )
    VALUES (
      v_composer_id,
      v_plano_ouro_id,
      'active',
      v_start_date,
      v_end_date,
      'manual',
      'admin-test-ouro-' || gen_random_uuid()::text,
      NOW(),
      NOW()
    )
    ON CONFLICT (composer_id, plan_id, status) DO UPDATE
    SET
      status = 'active',
      start_date = v_start_date,
      end_date = v_end_date,
      updated_at = NOW();
    
    RAISE NOTICE 'Assinatura criada com sucesso';
  END IF;

  -- PASSO 4: Atualizar compositor como premium
  UPDATE dccmusic_composers
  SET
    is_premium = true,
    has_active_subscription = true,
    subscription_expires_at = v_end_date,
    updated_at = NOW()
  WHERE id = v_composer_id;

  RAISE NOTICE 'Compositor atualizado como premium';
  RAISE NOTICE '✅ Tudo pronto! Você agora tem acesso ao Plano Ouro!';
END $$;

-- Verificar resultado
SELECT 
  c.name as compositor,
  c.email,
  c.is_premium,
  c.has_active_subscription,
  c.subscription_expires_at,
  p.name as plano,
  p.slug as plano_slug,
  p.featured_musics_per_month,
  p.has_priority_featured,
  p.has_gold_badge,
  p.has_premium_layout,
  s.status as status_assinatura,
  s.start_date,
  s.end_date
FROM dccmusic_composers c
JOIN dccmusic_subscriptions s ON c.id = s.composer_id
JOIN dccmusic_plans p ON s.plan_id = p.id
WHERE (c.email = 'dcalaca@gmail.com' OR c.name ILIKE 'Douglas Calac%')
  AND s.status = 'active'
ORDER BY s.end_date DESC;
