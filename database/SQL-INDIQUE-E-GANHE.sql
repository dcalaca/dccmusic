-- DCC Music: independent referral ledger. No payment/provider/ad API changes.
-- All access is through authenticated server routes using service_role.
create table public.dcc_referral_links (
  composer_id uuid primary key references public.dccmusic_composers(id) on delete cascade,
  code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  created_at timestamptz not null default now()
);
create table public.dcc_referral_visits (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.dcc_referral_links(composer_id) on delete cascade,
  visitor_id uuid not null,
  bucket timestamptz not null,
  created_at timestamptz not null default now(),
  unique (referrer_id, visitor_id, bucket)
);
create index dcc_referral_visits_date_idx on public.dcc_referral_visits(referrer_id, created_at);
create table public.dcc_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.dcc_referral_links(composer_id) on delete cascade,
  referee_id uuid not null unique references public.dccmusic_composers(id) on delete cascade,
  visit_id uuid not null references public.dcc_referral_visits(id),
  status text not null default 'registered' check (status in ('registered','pending','released','limit_reached','cancelled')),
  registered_at timestamptz not null default now(),
  purchase_source text check (purchase_source in ('topup','plan')),
  purchase_id uuid,
  purchased_at timestamptz,
  released_at timestamptz,
  referrer_credits integer not null default 10 check (referrer_credits = 10),
  referee_credits integer not null default 5 check (referee_credits = 5),
  reward_month date,
  reward_slot integer check (reward_slot between 1 and 5),
  check (referrer_id <> referee_id),
  unique (referrer_id, reward_month, reward_slot)
);
create index dcc_referrals_date_idx on public.dcc_referrals(referrer_id, registered_at desc, id);
create index dcc_referrals_purchase_idx on public.dcc_referrals(referrer_id, purchased_at);
create index dcc_referrals_release_idx on public.dcc_referrals(referrer_id, released_at);
alter table public.dcc_referral_links enable row level security;
alter table public.dcc_referral_visits enable row level security;
alter table public.dcc_referrals enable row level security;
revoke all on public.dcc_referral_links, public.dcc_referral_visits, public.dcc_referrals from public, anon, authenticated;
grant all on public.dcc_referral_links, public.dcc_referral_visits, public.dcc_referrals to service_role;

create function public.dcc_attribute_referral(p_composer_id uuid, p_visit_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_visit public.dcc_referral_visits%rowtype; v_composer public.dccmusic_composers%rowtype;
begin
  select * into v_visit from public.dcc_referral_visits where id = p_visit_id and created_at >= now() - interval '30 days';
  if not found or v_visit.referrer_id = p_composer_id then return; end if;
  select * into v_composer from public.dccmusic_composers where id = p_composer_id;
  -- Signup-only attribution; logging in later cannot claim an existing account.
  if not found or v_composer.created_at < now() - interval '10 minutes' or v_composer.created_at < v_visit.created_at then return; end if;
  if exists(select 1 from public.dccmusic_composers c where c.id = v_visit.referrer_id and lower(trim(c.email)) = lower(trim(v_composer.email))) then return; end if;
  if exists(select 1 from public.studio_credit_topups where composer_id=p_composer_id and status in ('paid','refunded'))
    or exists(select 1 from public.dccmusic_payments where composer_id=p_composer_id and status in ('paid','refunded')) then return; end if;
  insert into public.dcc_referrals(referrer_id,referee_id,visit_id,registered_at)
    values(v_visit.referrer_id,p_composer_id,p_visit_id,v_composer.created_at) on conflict(referee_id) do nothing;
end;
$$;

create function public.dcc_process_referral(p_composer_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_ref public.dcc_referrals%rowtype;
  v_purchase record;
  v_month date;
  v_slot integer;
  v_status text;
begin
  select * into v_ref from public.dcc_referrals where referee_id=p_composer_id for update;
  if not found or v_ref.status in ('cancelled','limit_reached') then return; end if;
  if v_ref.purchase_id is null then
    select * into v_purchase from (
      select 'topup'::text as source,id,status,coalesce(paid_at,created_at) as purchased_at
        from public.studio_credit_topups where composer_id=p_composer_id and amount>0 and status in ('paid','refunded')
      union all
      select 'plan'::text,id,status,coalesce(paid_at at time zone 'UTC',created_at at time zone 'UTC')
        from public.dccmusic_payments where composer_id=p_composer_id and amount>0 and status in ('paid','refunded')
    ) purchases order by purchased_at,source,id limit 1;
    if not found then return; end if;
    -- This can never pay a bonus for a purchase made before the referred signup.
    if v_purchase.purchased_at < v_ref.registered_at then return; end if;
    update public.dcc_referrals set purchase_source=v_purchase.source,purchase_id=v_purchase.id,
      purchased_at=v_purchase.purchased_at,status='pending' where id=v_ref.id returning * into v_ref;
  end if;
  if v_ref.purchase_source='topup' then
    select status into v_status from public.studio_credit_topups where id=v_ref.purchase_id;
  else
    select status into v_status from public.dccmusic_payments where id=v_ref.purchase_id;
  end if;
  if v_status in ('refunded','cancelled','failed','charged_back') then
    if v_ref.status='released' then
      insert into public.studio_credit_transactions(composer_id,action,amount,month_key,description,metadata)
      values
        (v_ref.referrer_id,'referral_reward_reversal',10,to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM'),'Estorno de créditos: compra indicada cancelada',jsonb_build_object('referralId',v_ref.id,'referralRole','referrer')),
        (v_ref.referee_id,'referral_reward_reversal',5,to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM'),'Estorno de bônus: compra cancelada',jsonb_build_object('referralId',v_ref.id,'referralRole','referee'));
    end if;
    update public.dcc_referrals set status='cancelled' where id=v_ref.id;
    return;
  end if;
  if v_ref.status='released' or v_status <> 'paid' then return; end if;
  if not exists(select 1 from public.dccmusic_composers where id=v_ref.referee_id and email_verified=true)
    or not exists(select 1 from public.dccmusic_composers where id=v_ref.referrer_id and email_verified=true) then return; end if;
  -- Serialize the monthly cap across concurrent purchases from different friends.
  perform 1 from public.dcc_referral_links where composer_id=v_ref.referrer_id for update;
  v_month := date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
  select min(slot) into v_slot from generate_series(1,5) slot where not exists(
    select 1 from public.dcc_referrals r where r.referrer_id=v_ref.referrer_id and r.reward_month=v_month and r.reward_slot=slot
  );
  if v_slot is null then
    update public.dcc_referrals set status='limit_reached' where id=v_ref.id;
    return;
  end if;
  -- These credits use the existing bonus ledger; the balance code is unchanged.
  insert into public.studio_credit_transactions(composer_id,action,amount,month_key,description,metadata)
  values
    (v_ref.referrer_id,'manual_credit',10,to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM'),'Indique e ganhe: primeira compra do seu amigo',jsonb_build_object('referralId',v_ref.id,'referralRole','referrer','source','referral')),
    (v_ref.referee_id,'manual_credit',5,to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM'),'Indique e ganhe: bônus da sua primeira compra',jsonb_build_object('referralId',v_ref.id,'referralRole','referee','source','referral'));
  update public.dcc_referrals set status='released',released_at=now(),reward_month=v_month,reward_slot=v_slot where id=v_ref.id;
end;
$$;

create function public.dcc_referral_payment_observer()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status in ('paid','refunded','cancelled','failed','charged_back') then
    perform public.dcc_process_referral(new.composer_id);
  end if;
  return new;
exception when others then
  -- Referral failures roll back ONLY the observer's subtransaction, never a payment.
  raise warning 'DCC referral observer failed: %',SQLERRM;
  return new;
end;
$$;
create trigger dcc_referral_topup_observer after insert or update of status on public.studio_credit_topups
  for each row execute function public.dcc_referral_payment_observer();
create trigger dcc_referral_plan_observer after insert or update of status on public.dccmusic_payments
  for each row execute function public.dcc_referral_payment_observer();

create function public.dcc_referral_verification_observer()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if new.email_verified=true and old.email_verified is distinct from true then
    for v_id in select referee_id from public.dcc_referrals where status='pending' and (referee_id=new.id or referrer_id=new.id) loop
      perform public.dcc_process_referral(v_id);
    end loop;
  end if;
  return new;
exception when others then
  raise warning 'DCC referral verification observer failed: %',SQLERRM;
  return new;
end;
$$;
create trigger dcc_referral_email_observer after update of email_verified on public.dccmusic_composers
  for each row execute function public.dcc_referral_verification_observer();

create function public.dcc_referral_dashboard(p_composer_id uuid,p_from timestamptz,p_to timestamptz,p_page integer default 1,p_page_size integer default 10)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_code text; v_total integer; v_pages integer; v_page integer; v_history jsonb; v_stats jsonb; v_id uuid;
begin
  if p_page<1 or p_page_size<>10 or p_to<=p_from then raise exception 'Invalid referral dashboard parameters'; end if;
  insert into public.dcc_referral_links(composer_id) values(p_composer_id) on conflict(composer_id) do nothing;
  select code into v_code from public.dcc_referral_links where composer_id=p_composer_id;
  -- Recover an observer error on the next dashboard load, using confirmed DB payments.
  for v_id in select r.referee_id from public.dcc_referrals r where r.referrer_id=p_composer_id and (
    (r.status in ('registered','pending') and (
      exists(select 1 from public.studio_credit_topups t where t.composer_id=r.referee_id and t.amount>0 and t.status in ('paid','refunded')) or
      exists(select 1 from public.dccmusic_payments p where p.composer_id=r.referee_id and p.amount>0 and p.status in ('paid','refunded'))
    )) or (r.status='released' and (
      (r.purchase_source='topup' and exists(select 1 from public.studio_credit_topups t where t.id=r.purchase_id and t.status in ('refunded','cancelled','failed','charged_back'))) or
      (r.purchase_source='plan' and exists(select 1 from public.dccmusic_payments p where p.id=r.purchase_id and p.status in ('refunded','cancelled','failed','charged_back')))
    ))
  ) loop
    begin perform public.dcc_process_referral(v_id); exception when others then raise warning 'DCC referral reconciliation failed: %',SQLERRM; end;
  end loop;
  select count(*) into v_total from public.dcc_referrals where referrer_id=p_composer_id and registered_at>=p_from and registered_at<p_to;
  v_pages := greatest(1,ceil(v_total/10.0)::integer);
  v_page := least(p_page,v_pages);
  select coalesce(jsonb_agg(row_data order by registered_at desc,id desc),'[]'::jsonb) into v_history from (
    select r.registered_at,r.id,jsonb_build_object('id',r.id,'date',r.registered_at,'purchaseDate',r.purchased_at,'releasedAt',r.released_at,
      'name',coalesce(nullif(split_part(trim(c.name),' ',1),''),'Compositor') || case when array_length(string_to_array(trim(c.name),' '),1)>1 then ' '||left(split_part(trim(c.name),' ',2),1)||'.' else '' end,
      'status',r.status,'credits',case when r.status in ('released','pending') then r.referrer_credits else 0 end) as row_data
    from public.dcc_referrals r join public.dccmusic_composers c on c.id=r.referee_id
    where r.referrer_id=p_composer_id and r.registered_at>=p_from and r.registered_at<p_to
    order by r.registered_at desc,r.id desc limit 10 offset (v_page-1)*10
  ) history;
  select jsonb_build_object(
    'clicks',(select count(*) from public.dcc_referral_visits where referrer_id=p_composer_id and created_at>=p_from and created_at<p_to),
    'signups',v_total,
    'purchases',(select count(*) from public.dcc_referrals where referrer_id=p_composer_id and purchased_at>=p_from and purchased_at<p_to and status in ('pending','released','limit_reached')),
    'released',(select coalesce(sum(referrer_credits),0) from public.dcc_referrals where referrer_id=p_composer_id and released_at>=p_from and released_at<p_to and status='released'),
    'pending',(select coalesce(sum(referrer_credits),0) from public.dcc_referrals where referrer_id=p_composer_id and purchased_at>=p_from and purchased_at<p_to and status='pending')
  ) into v_stats;
  return jsonb_build_object('code',v_code,'stats',v_stats,'history',v_history,'page',v_page,'pages',v_pages,'total',v_total);
end;
$$;
revoke all on function public.dcc_attribute_referral(uuid,uuid),public.dcc_process_referral(uuid),public.dcc_referral_payment_observer(),public.dcc_referral_verification_observer(),public.dcc_referral_dashboard(uuid,timestamptz,timestamptz,integer,integer) from public,anon,authenticated;
grant execute on function public.dcc_attribute_referral(uuid,uuid),public.dcc_process_referral(uuid),public.dcc_referral_payment_observer(),public.dcc_referral_verification_observer(),public.dcc_referral_dashboard(uuid,timestamptz,timestamptz,integer,integer) to service_role;
