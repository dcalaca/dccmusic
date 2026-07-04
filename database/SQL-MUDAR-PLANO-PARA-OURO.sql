-- ============================================
-- SQL PARA MUDAR PLANO DO COMPOSITOR PARA OURO
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script atualiza a assinatura existente para o plano Ouro
-- ============================================

DO $$
DECLARE
  v_plano_ouro_id UUID;
  v_composer_id UUID;
BEGIN
  -- PASSO 1: Buscar ou criar plano Ouro
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
      199.00,
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
      5,
      true,
      true,
      true,
      true,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_plano_ouro_id;
    
    RAISE NOTICE 'Plano Ouro criado com ID: %', v_plano_ouro_id;
  ELSE
    -- Atualizar plano existente para garantir vantagens
    UPDATE dccmusic_plans
    SET
      featured_musics_per_month = 5,
      has_priority_featured = true,
      has_gold_badge = true,
      has_premium_layout = true,
      updated_at = NOW()
    WHERE id = v_plano_ouro_id;
    
    RAISE NOTICE 'Plano Ouro encontrado e atualizado: %', v_plano_ouro_id;
  END IF;

  -- PASSO 2: Buscar compositor
  SELECT id INTO v_composer_id
  FROM dccmusic_composers
  WHERE email = 'dcalaca@gmail.com' OR name ILIKE 'Douglas Calac%'
  LIMIT 1;

  IF v_composer_id IS NULL THEN
    RAISE EXCEPTION 'Compositor não encontrado!';
  END IF;

  RAISE NOTICE 'Compositor encontrado: %', v_composer_id;

  -- PASSO 3: Atualizar assinatura existente para o plano Ouro
  UPDATE dccmusic_subscriptions
  SET
    plan_id = v_plano_ouro_id,
    status = 'active',
    updated_at = NOW()
  WHERE composer_id = v_composer_id
    AND status = 'active';

  -- Se não tinha assinatura ativa, criar uma nova
  IF NOT FOUND THEN
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
      NOW(),
      NOW() + INTERVAL '10 years',
      'manual',
      'admin-ouro-' || gen_random_uuid()::text,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Nova assinatura criada';
  ELSE
    RAISE NOTICE 'Assinatura atualizada para plano Ouro';
  END IF;

  -- PASSO 4: Garantir que compositor está marcado como premium
  UPDATE dccmusic_composers
  SET
    is_premium = true,
    has_active_subscription = true,
    subscription_expires_at = NOW() + INTERVAL '10 years',
    updated_at = NOW()
  WHERE id = v_composer_id;

  RAISE NOTICE '✅ Plano atualizado para Ouro com sucesso!';
END $$;

-- Verificar resultado
SELECT 
  c.name as compositor,
  c.email,
  c.is_premium,
  p.name as plano,
  p.slug,
  p.featured_musics_per_month,
  p.has_priority_featured as prioridade,
  p.has_gold_badge as selo_ouro,
  p.has_premium_layout as layout_premium,
  s.status,
  s.end_date
FROM dccmusic_composers c
JOIN dccmusic_subscriptions s ON c.id = s.composer_id
JOIN dccmusic_plans p ON s.plan_id = p.id
WHERE (c.email = 'dcalaca@gmail.com' OR c.name ILIKE 'Douglas Calac%')
  AND s.status = 'active'
ORDER BY s.end_date DESC;
