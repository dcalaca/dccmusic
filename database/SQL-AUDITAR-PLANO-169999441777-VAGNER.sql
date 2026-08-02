-- Auditoria do pagamento de plano Mercado Pago 169999441777
-- Cliente: Vagner / compositor 463bd6d7-0d22-49e3-aa4f-a14a6811dfb9
--
-- Objetivo:
-- 1. Ver status do pagamento no nosso banco.
-- 2. Ver se a assinatura ainda está active.
-- 3. Ver se is_premium / has_active_subscription continuam true.
--
-- Como usar no Supabase:
-- 1. Abra o painel do Supabase.
-- 2. Clique em SQL Editor.
-- 3. Cole este arquivo inteiro.
-- 4. Clique em Run.
-- 5. Confira o resultado com o detalhe do pagamento no app/painel do Mercado Pago
--    (ID 169999441777). Se lá estiver refunded/charged_back/cancelled e aqui
--    ainda estiver paid + Premium ativo, rode o SQL de correção.

-- 1) Compositor
select
  id,
  name,
  email,
  is_premium,
  has_active_subscription,
  subscription_expires_at,
  created_at,
  updated_at
from public.dccmusic_composers
where id = '463bd6d7-0d22-49e3-aa4f-a14a6811dfb9';

-- 2) Pagamento pelo ID do Mercado Pago
select
  p.id as payment_row_id,
  p.composer_id,
  p.subscription_id,
  p.amount,
  p.currency,
  p.status,
  p.payment_method,
  p.payment_gateway,
  p.gateway_payment_id,
  p.paid_at,
  p.created_at,
  p.updated_at,
  p.gateway_response->>'status' as mp_status_in_gateway_response,
  p.gateway_response->>'status_detail' as mp_status_detail,
  p.gateway_response->>'transaction_amount' as mp_transaction_amount
from public.dccmusic_payments p
where p.gateway_payment_id = '169999441777'
   or p.gateway_payment_id = '169999441777'::text;

-- 3) Assinatura ligada a esse pagamento (e todas do compositor)
select
  s.id as subscription_id,
  s.composer_id,
  s.plan_id,
  s.status,
  s.payment_id,
  s.start_date,
  s.end_date,
  s.created_at,
  s.updated_at,
  pl.name as plan_name,
  pl.price as plan_price
from public.dccmusic_subscriptions s
left join public.dccmusic_plans pl on pl.id = s.plan_id
where s.composer_id = '463bd6d7-0d22-49e3-aa4f-a14a6811dfb9'
   or s.payment_id = '169999441777'
   or s.payment_id::text = '169999441777'
order by s.created_at desc;

-- 4) Resumo rápido: o que está inconsistente?
select
  c.name as compositor,
  c.is_premium,
  c.has_active_subscription,
  c.subscription_expires_at,
  p.status as payment_status,
  p.amount as payment_amount,
  p.gateway_payment_id,
  p.paid_at,
  s.status as subscription_status,
  s.end_date as subscription_end_date,
  case
    when p.status = 'paid'
      and (
        coalesce(p.gateway_response->>'status', '') in ('refunded', 'charged_back', 'cancelled')
        or c.is_premium = true
      )
      then 'ATENCAO: pagamento ainda paid no sistema — confirme estorno no Mercado Pago'
    when p.status = 'refunded' and c.is_premium = true
      then 'INCONSISTENTE: pagamento estornado mas Premium ainda ativo'
    when p.status = 'paid' and c.is_premium = true and s.status = 'active'
      then 'OK aparente no banco (ainda precisa confirmar status real no Mercado Pago)'
    else 'Revisar manualmente os campos acima'
  end as diagnostico
from public.dccmusic_composers c
left join public.dccmusic_payments p
  on p.composer_id = c.id
 and p.gateway_payment_id = '169999441777'
left join public.dccmusic_subscriptions s
  on s.id = p.subscription_id
where c.id = '463bd6d7-0d22-49e3-aa4f-a14a6811dfb9';
