-- Correção manual do estorno do plano Mercado Pago 169999441777
-- Cliente: Vagner / compositor 463bd6d7-0d22-49e3-aa4f-a14a6811dfb9
--
-- IMPORTANTE:
-- Só execute este SQL DEPOIS de confirmar no Mercado Pago que o pagamento
-- 169999441777 foi realmente estornado / contestado / cancelado após aprovação.
--
-- Objetivo:
-- 1. Marcar o pagamento como refunded.
-- 2. Cancelar a assinatura ligada a esse payment_id.
-- 3. Remover Premium do compositor (se não houver outra assinatura active válida).
-- 4. Ser idempotente (pode rodar de novo sem duplicar efeito).
--
-- Como usar no Supabase:
-- 1. Abra o painel do Supabase.
-- 2. Clique em SQL Editor.
-- 3. Cole este arquivo inteiro.
-- 4. Clique em Run.
-- 5. Depois rode de novo o SQL-AUDITAR-PLANO-169999441777-VAGNER.sql para conferir.
-- 6. Atualize a página do extrato no admin.

do $$
declare
  v_payment_id text := '169999441777';
  v_composer_id uuid := '463bd6d7-0d22-49e3-aa4f-a14a6811dfb9';
  v_payment record;
  v_subscription_id uuid;
  v_still_active_end timestamptz;
begin
  select
    p.*
  into v_payment
  from public.dccmusic_payments p
  where p.gateway_payment_id = v_payment_id
    and p.composer_id = v_composer_id
  order by p.created_at desc
  limit 1;

  if v_payment.id is null then
    raise exception
      'Pagamento % nao encontrado para o compositor %',
      v_payment_id,
      v_composer_id;
  end if;

  v_subscription_id := v_payment.subscription_id;

  -- 1) Marcar pagamento como estornado (mantém paid_at para histórico)
  update public.dccmusic_payments
  set
    status = 'refunded',
    gateway_response = coalesce(gateway_response, '{}'::jsonb) || jsonb_build_object(
      'manual_refund_audit', jsonb_build_object(
        'registered_at', now(),
        'reason', 'Estorno/cancelamento confirmado manualmente no Mercado Pago',
        'payment_id', v_payment_id
      )
    ),
    updated_at = now()
  where id = v_payment.id;

  -- 2) Cancelar assinatura ligada a este pagamento
  if v_subscription_id is not null then
    update public.dccmusic_subscriptions
    set
      status = 'cancelled',
      payment_id = coalesce(payment_id, v_payment_id),
      updated_at = now()
    where id = v_subscription_id;
  else
    update public.dccmusic_subscriptions
    set
      status = 'cancelled',
      payment_id = coalesce(payment_id, v_payment_id),
      updated_at = now()
    where composer_id = v_composer_id
      and (
        payment_id = v_payment_id
        or payment_id::text = v_payment_id
      )
      and status = 'active';
  end if;

  -- 3) Se sobrar outra assinatura active válida, mantém Premium; senão, revoga
  select max(s.end_date)
  into v_still_active_end
  from public.dccmusic_subscriptions s
  where s.composer_id = v_composer_id
    and s.status = 'active'
    and s.end_date > now();

  if v_still_active_end is null then
    update public.dccmusic_composers
    set
      is_premium = false,
      has_active_subscription = false,
      subscription_expires_at = null,
      updated_at = now()
    where id = v_composer_id;
  else
    update public.dccmusic_composers
    set
      is_premium = true,
      has_active_subscription = true,
      subscription_expires_at = v_still_active_end,
      updated_at = now()
    where id = v_composer_id;
  end if;

  raise notice
    'Estorno do plano % aplicado. Pagamento %, assinatura %, premium_restante=%',
    v_payment_id,
    v_payment.id,
    v_subscription_id,
    (v_still_active_end is not null);
end $$;

-- Conferência final
select
  c.name,
  c.is_premium,
  c.has_active_subscription,
  c.subscription_expires_at,
  p.status as payment_status,
  p.gateway_payment_id,
  p.amount,
  p.paid_at,
  s.status as subscription_status,
  s.end_date
from public.dccmusic_composers c
join public.dccmusic_payments p
  on p.composer_id = c.id
 and p.gateway_payment_id = '169999441777'
left join public.dccmusic_subscriptions s
  on s.id = p.subscription_id
where c.id = '463bd6d7-0d22-49e3-aa4f-a14a6811dfb9';
