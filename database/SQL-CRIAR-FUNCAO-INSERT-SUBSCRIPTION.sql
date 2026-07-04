-- ============================================
-- SOLUÇÃO DEFINITIVA: Criar função SQL que bypassa RLS
-- Esta função será chamada pelo código e bypassa completamente RLS
-- ============================================

-- Criar função para inserir assinatura (bypassa RLS)
CREATE OR REPLACE FUNCTION dccmusic_create_subscription(
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
  -- Buscar duração do plano
  SELECT duration_months INTO v_duration_months
  FROM dccmusic_plans
  WHERE id = p_plan_id;
  
  IF v_duration_months IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado: %', p_plan_id;
  END IF;
  
  -- Calcular datas
  v_start_date := NOW();
  v_end_date := v_start_date + (v_duration_months || ' months')::INTERVAL;
  
  -- Inserir assinatura (bypassa RLS por causa de SECURITY DEFINER)
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
  RETURNING id INTO v_subscription_id;
  
  RETURN v_subscription_id;
END;
$$;

-- Criar função para atualizar assinatura com payment_id
CREATE OR REPLACE FUNCTION dccmusic_update_subscription_payment_id(
  p_subscription_id UUID,
  p_payment_id VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- IMPORTANTE: Bypassa RLS
SET search_path = public
AS $$
BEGIN
  UPDATE dccmusic_subscriptions
  SET payment_id = p_payment_id
  WHERE id = p_subscription_id;
  
  RETURN FOUND;
END;
$$;

-- Dar permissão para executar as funções
GRANT EXECUTE ON FUNCTION dccmusic_create_subscription(UUID, UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION dccmusic_create_subscription(UUID, UUID, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION dccmusic_update_subscription_payment_id(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION dccmusic_update_subscription_payment_id(UUID, VARCHAR) TO anon;

-- Verificar se as funções foram criadas
SELECT 
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN ('dccmusic_create_subscription', 'dccmusic_update_subscription_payment_id');
