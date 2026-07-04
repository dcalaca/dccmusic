-- Registra manualmente o estorno/contestacao da recarga Mercado Pago 159861906429.
-- Cliente: Jhon Love / alanjonsr3@gmail.com
--
-- Objetivo:
-- 1. Marcar a recarga como refunded.
-- 2. Inserir uma movimentacao de credito negativa (-230) no extrato.
-- 3. Nao duplicar nada se este SQL for executado mais de uma vez.
--
-- Como usar no Supabase:
-- 1. Abra o painel do Supabase.
-- 2. Clique em SQL Editor.
-- 3. Cole este arquivo inteiro.
-- 4. Clique em Run.

do $$
declare
  v_topup record;
  v_payment_id text := '159861906429';
begin
  select
    t.*
  into v_topup
  from public.studio_credit_topups t
  join public.dccmusic_composers c on c.id = t.composer_id
  where (
      t.payment_id = v_payment_id
      or t.external_reference ilike '%159861906429%'
      or (
        lower(c.email) = lower('alanjonsr3@gmail.com')
        and t.music_quantity = 23
        and t.credits = 230
      )
    )
  order by
    case when t.payment_id = v_payment_id then 0 else 1 end,
    t.created_at desc
  limit 1;

  if v_topup.id is null then
    raise exception 'Recarga nao encontrada para payment_id % / alanjonsr3@gmail.com', v_payment_id;
  end if;

  update public.studio_credit_topups
  set
    status = 'refunded',
    payment_id = coalesce(payment_id, v_payment_id),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'manual_refund_audit', jsonb_build_object(
        'registered_at', now(),
        'reason', 'Contestacao/estorno confirmado manualmente no Mercado Pago',
        'payment_id', v_payment_id
      )
    ),
    updated_at = now()
  where id = v_topup.id;

  insert into public.studio_credit_transactions (
    composer_id,
    project_id,
    action,
    amount,
    month_key,
    description,
    metadata,
    created_at
  )
  select
    v_topup.composer_id,
    null,
    'credit_topup_refund',
    coalesce(v_topup.credits, 0),
    coalesce(v_topup.month_key, to_char(now() at time zone 'UTC', 'YYYY-MM')),
    'Estorno/contestação de recarga Studio IA: ' || coalesce(v_topup.music_quantity, 0) || ' músicas',
    jsonb_build_object(
      'topupId', v_topup.id,
      'paymentId', v_payment_id,
      'amount', v_topup.amount,
      'credits', v_topup.credits,
      'musicQuantity', v_topup.music_quantity,
      'reason', 'manual_refund_audit',
      'source', 'manual_sql'
    ),
    now()
  where not exists (
    select 1
    from public.studio_credit_transactions tr
    where tr.composer_id = v_topup.composer_id
      and tr.action = 'credit_topup_refund'
      and (
        tr.metadata->>'topupId' = v_topup.id::text
        or tr.metadata->>'paymentId' = v_payment_id
      )
  );

  raise notice 'Estorno registrado para topup %, payment %, creditos %',
    v_topup.id,
    v_payment_id,
    v_topup.credits;
end $$;

-- Conferencia depois do ajuste.
select
  tr.created_at,
  tr.action,
  tr.description,
  tr.amount,
  tr.metadata->>'paymentId' as payment_id,
  tr.metadata->>'topupId' as topup_id
from public.studio_credit_transactions tr
join public.dccmusic_composers c on c.id = tr.composer_id
where lower(c.email) = lower('alanjonsr3@gmail.com')
order by tr.created_at desc;
