  -- Creditar manualmente 23 músicas para Alex Arte
  -- E-mail: alexrlima2016@gmail.com
  -- Slug: /alex-arte
  -- 23 músicas x 10 créditos = 230 créditos
  --
  -- Pode rodar mais de uma vez: o idempotencyKey impede duplicidade.

  do $$
  declare
    v_composer_id uuid;
    v_composer_name text;
    v_month_key text := to_char(timezone('UTC', now()), 'YYYY-MM');
    v_music_quantity integer := 23;
    v_credits integer := 230;
    v_idempotency_key text := 'manual-credit:alexrlima2016@gmail.com:230:2026-05-24';
  begin
    select id, name
      into v_composer_id, v_composer_name
    from public.dccmusic_composers
    where lower(email) = lower('alexrlima2016@gmail.com')
      and slug = 'alex-arte'
    limit 1;

    if v_composer_id is null then
      raise exception 'Compositor não encontrado para alexrlima2016@gmail.com / alex-arte';
    end if;

    if exists (
      select 1
      from public.studio_credit_transactions
      where composer_id = v_composer_id
        and action = 'manual_credit'
        and metadata->>'idempotencyKey' = v_idempotency_key
    ) then
      raise notice 'Crédito manual já existia. Nenhuma nova linha foi criada.';
      return;
    end if;

    insert into public.studio_credit_transactions (
      composer_id,
      action,
      amount,
      month_key,
      description,
      metadata
    ) values (
      v_composer_id,
      'manual_credit',
      v_credits,
      v_month_key,
      'Crédito manual administrativo: 23 música(s)',
      jsonb_build_object(
        'source', 'admin_manual_credit',
        'musicQuantity', v_music_quantity,
        'credits', v_credits,
        'reason', 'Crédito manual solicitado pelo admin',
        'adminEmail', 'dcalaca@gmail.com',
        'idempotencyKey', v_idempotency_key
      )
    );

    raise notice 'Creditado com sucesso: % créditos para % (%)', v_credits, v_composer_name, v_composer_id;
  end $$;

  -- Conferência do lançamento criado
  select
    c.name,
    c.email,
    c.slug,
    t.action,
    t.amount as creditos,
    floor(t.amount / 10) as musicas,
    t.description,
    t.created_at,
    t.metadata
  from public.studio_credit_transactions t
  join public.dccmusic_composers c on c.id = t.composer_id
  where lower(c.email) = lower('alexrlima2016@gmail.com')
    and c.slug = 'alex-arte'
    and t.action = 'manual_credit'
    and t.metadata->>'idempotencyKey' = 'manual-credit:alexrlima2016@gmail.com:230:2026-05-24'
  order by t.created_at desc;
