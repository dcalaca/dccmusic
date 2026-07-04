-- ============================================
-- Função SQL para buscar ou criar assinatura
-- Esta função bypassa RLS e garante que não haverá duplicatas
-- ============================================

-- Criar função para buscar ou criar assinatura (bypassa RLS)
CREATE OR REPLACE FUNCTION dccmusic_get_or_create_subscription(
  p_composer_id UUID,
  p_plan_id UUID,
  p_status VARCHAR DEFAULT 'pending'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- IMPORTANTE: Bypassa RLS
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_start_date TIMESTAMP;
  v_end_date TIMESTAMP;
  v_duration_months INTEGER;
BEGIN
  -- Primeiro, tentar buscar assinatura existente
  SELECT id INTO v_subscription_id
  FROM dccmusic_subscriptions
  WHERE composer_id = p_composer_id
    AND plan_id = p_plan_id
    AND status = p_status
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Se encontrou, retornar
  IF v_subscription_id IS NOT NULL THEN
    RETURN v_subscription_id;
  END IF;
  
  -- Se não encontrou, buscar duração do plano
  SELECT duration_months INTO v_duration_months
  FROM dccmusic_plans
  WHERE id = p_plan_id;
  
  IF v_duration_months IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado: %', p_plan_id;
  END IF;
  
  -- Calcular datas
  v_start_date := NOW();
  v_end_date := v_start_date + (v_duration_months || ' months')::INTERVAL;
  
  -- Tentar inserir assinatura (bypassa RLS por causa de SECURITY DEFINER)
  INSERT INTO dccmusic_subscriptions (
    composer_id,
    plan_id,
    status,
    start_date,
    end_date
  )
  VALUES (
    p_composer_id,
    p_plan_id,
    p_status,
    v_start_date,
    v_end_date
  )
  ON CONFLICT (composer_id, plan_id, status) DO NOTHING
  RETURNING id INTO v_subscription_id;
  
  -- Se ainda não tem ID (por causa do ON CONFLICT), buscar novamente
  IF v_subscription_id IS NULL THEN
    SELECT id INTO v_subscription_id
    FROM dccmusic_subscriptions
    WHERE composer_id = p_composer_id
      AND plan_id = p_plan_id
      AND status = p_status
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  IF v_subscription_id IS NULL THEN
    RAISE EXCEPTION 'Erro ao criar ou buscar assinatura';
  END IF;
  
  RETURN v_subscription_id;
END;
$$;

-- Dar permissão para executar a função
GRANT EXECUTE ON FUNCTION dccmusic_get_or_create_subscription(UUID, UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION dccmusic_get_or_create_subscription(UUID, UUID, VARCHAR) TO anon;

-- Verificar se a função foi criada
SELECT 
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'dccmusic_get_or_create_subscription';
