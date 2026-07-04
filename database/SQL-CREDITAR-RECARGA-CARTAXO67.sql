-- Crédito manual das recargas avulsas pagas no Mercado Pago.
-- Cliente: cartaxo67@gmail.com
-- Transações Mercado Pago:
--   159678889013
--   159678414823
-- Cada pagamento: R$ 1,53 = 1 música = 10 créditos
-- Total, se NÃO houver estorno: 2 músicas = 20 créditos

do $$
declare
  v_email text := 'cartaxo67@gmail.com';
  v_amount numeric(10,2) := 1.53;
  v_music_quantity integer := 1;
  v_credits integer := 10;
  v_composer_id uuid;
  v_topup_id uuid;
  v_month_key text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  v_payment_id text;
begin
  select id
    into v_composer_id
    from public.dccmusic_composers
   where lower(email) = lower(v_email)
   order by created_at desc
   limit 1;

  if v_composer_id is null then
    raise exception 'Compositor não encontrado para o e-mail %', v_email;
  end if;

  foreach v_payment_id in array array['159678889013', '159678414823']
  loop
    v_topup_id := null;

    select id
      into v_topup_id
      from public.studio_credit_topups
     where composer_id = v_composer_id
       and payment_id = v_payment_id
     order by created_at desc
     limit 1;

    if v_topup_id is null then
      insert into public.studio_credit_topups (
        composer_id,
        package_slug,
        music_quantity,
        credits,
        amount,
        currency,
        status,
        payment_gateway,
        payment_id,
        external_reference,
        month_key,
        metadata,
        paid_at,
        updated_at
      )
      values (
        v_composer_id,
        'manual-1-musica',
        v_music_quantity,
        v_credits,
        v_amount,
        'BRL',
        'paid',
        'mercadopago',
        v_payment_id,
        'manual-studio-topup:' || v_email || ':' || v_payment_id,
        v_month_key,
        jsonb_build_object(
          'manualCredit', true,
          'reason', 'Webhook Mercado Pago não creditou automaticamente',
          'paymentId', v_payment_id,
          'payerEmail', v_email
        ),
        now(),
        now()
      )
      returning id into v_topup_id;
    else
      update public.studio_credit_topups
         set status = 'paid',
             payment_gateway = coalesce(payment_gateway, 'mercadopago'),
             paid_at = coalesce(paid_at, now()),
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'manualCredit', true,
               'reason', 'Webhook Mercado Pago não creditou automaticamente',
               'paymentId', v_payment_id,
               'payerEmail', v_email
             ),
             updated_at = now()
       where id = v_topup_id;
    end if;

    if not exists (
      select 1
        from public.studio_credit_transactions
       where composer_id = v_composer_id
         and action = 'credit_topup'
         and metadata @> jsonb_build_object('paymentId', v_payment_id)
    ) then
      insert into public.studio_credit_transactions (
        composer_id,
        project_id,
        action,
        amount,
        month_key,
        description,
        metadata
      )
      values (
        v_composer_id,
        null,
        'credit_topup',
        v_credits,
        v_month_key,
        'Recarga avulsa Studio IA: 1 música',
        jsonb_build_object(
          'topupId', v_topup_id,
          'paymentId', v_payment_id,
          'manualCredit', true,
          'amount', v_amount
        )
      );
    end if;
  end loop;
end $$;
