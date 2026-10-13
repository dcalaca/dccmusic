-- Integration assertions against the real schema. Every fixture is rolled back.
begin;
set local role service_role;
do $$
declare
  owner_id uuid:=gen_random_uuid(); friend_id uuid; visit_id uuid;
  v_payment_id uuid; v_subscription_id uuid; v_plan_id uuid; first_friend uuid; first_payment uuid;
  pending_friend uuid; pending_payment uuid; dashboard jsonb; i integer;
begin
  insert into public.dccmusic_composers(id,name,slug,email,email_verified)
    values(owner_id,'Referral QA '||owner_id,owner_id::text,owner_id||'@example.invalid',true);
  perform public.dcc_referral_dashboard(owner_id,now()-interval '1 day',now()+interval '1 day',1,10);
  insert into public.dcc_referral_visits(referrer_id,visitor_id,bucket,created_at)
    values(owner_id,gen_random_uuid(),now(),now()-interval '1 second') returning id into visit_id;

  -- Self-referrals are rejected.
  perform public.dcc_attribute_referral(owner_id,visit_id);
  if exists(select 1 from public.dcc_referrals where referee_id=owner_id) then raise exception 'Self referral accepted'; end if;

  for i in 1..12 loop
    friend_id:=gen_random_uuid();
    insert into public.dccmusic_composers(id,name,slug,email,email_verified)
      values(friend_id,'Friend QA '||friend_id,friend_id::text,friend_id||'@example.invalid',i<>1);
    perform public.dcc_attribute_referral(friend_id,visit_id);
    perform public.dcc_attribute_referral(friend_id,visit_id);
    if (select count(*) from public.dcc_referrals where referee_id=friend_id)<>1 then raise exception 'Attribution is not idempotent'; end if;
    if i>7 then continue; end if;
    -- Both plan and topup purchases qualify, but pending or zero-amount purchases do not.
    if i in (3,7) then
      select id into v_plan_id from public.dccmusic_plans limit 1;
      insert into public.dccmusic_subscriptions(composer_id,plan_id,start_date,end_date) values(friend_id,v_plan_id,now(),now()+interval '30 days') returning id into v_subscription_id;
      insert into public.dccmusic_payments(subscription_id,composer_id,amount,status,currency,payment_gateway)
        values(v_subscription_id,friend_id,19.90,'paid','BRL','qa') returning id into v_payment_id;
    else
      insert into public.studio_credit_topups(composer_id,package_slug,music_quantity,credits,amount,status,month_key,external_reference)
        values(friend_id,'qa-referral',1,10,9.96,'pending',to_char(now(),'YYYY-MM'),gen_random_uuid()::text) returning id into v_payment_id;
      if (select status from public.dcc_referrals where referee_id=friend_id)<>'registered' then raise exception 'Pending payment qualified'; end if;
      update public.studio_credit_topups set status='paid',paid_at=now() where id=v_payment_id;
    end if;
    if i=1 then
      pending_friend:=friend_id; pending_payment:=v_payment_id;
      if (select status from public.dcc_referrals where referee_id=friend_id)<>'pending' then raise exception 'Unverified email released reward'; end if;
      update public.dccmusic_composers set email_verified=true where id=friend_id;
    end if;
    if i<=5 then
      if (select status from public.dcc_referrals where referee_id=friend_id)<>'released' then raise exception 'Reward not released for friend %',i; end if;
      if (select sum(amount) from public.studio_credit_transactions where composer_id=friend_id and metadata->>'source'='referral')<>5 then raise exception 'Incorrect friend bonus'; end if;
      if i=2 then first_friend:=friend_id; first_payment:=v_payment_id; end if;
      perform public.dcc_process_referral(friend_id);
      if (select count(*) from public.studio_credit_transactions where composer_id=friend_id and metadata->>'source'='referral')<>1 then raise exception 'Duplicate reward'; end if;
      insert into public.studio_credit_topups(composer_id,package_slug,music_quantity,credits,amount,status,paid_at,month_key,external_reference)
        values(friend_id,'qa-referral',1,10,9.96,'paid',now()+interval '1 second',to_char(now(),'YYYY-MM'),gen_random_uuid()::text);
      if (select count(*) from public.studio_credit_transactions where composer_id=friend_id and metadata->>'source'='referral')<>1 then raise exception 'Second purchase rewarded'; end if;
    else
      if (select status from public.dcc_referrals where referee_id=friend_id)<>'limit_reached' then raise exception 'Monthly cap failed'; end if;
    end if;
  end loop;
  if (select sum(amount) from public.studio_credit_transactions where composer_id=owner_id and metadata->>'source'='referral')<>50 then raise exception 'Incorrect owner credits'; end if;

  dashboard:=public.dcc_referral_dashboard(owner_id,now()-interval '1 day',now()+interval '1 day',1,10);
  if (dashboard->>'total')::int<>12 or jsonb_array_length(dashboard->'history')<>10 or (dashboard->>'pages')::int<>2 then raise exception '10-row pagination failed'; end if;
  dashboard:=public.dcc_referral_dashboard(owner_id,now()-interval '1 day',now()+interval '1 day',99,10);
  if (dashboard->>'page')::int<>2 or jsonb_array_length(dashboard->'history')<>2 then raise exception 'Last page failed'; end if;
  if dashboard->'stats'->>'purchases'<>'7' or dashboard->'stats'->>'released'<>'50' then raise exception 'Dashboard totals incorrect: %',dashboard->'stats'; end if;
  if dashboard::text like '%@example.invalid%' then raise exception 'Dashboard exposed email'; end if;

  update public.studio_credit_topups set status='refunded' where id=first_payment;
  perform public.dcc_process_referral(first_friend);
  if (select status from public.dcc_referrals where referee_id=first_friend)<>'cancelled' then raise exception 'Refund not cancelled'; end if;
  if (select sum(amount) from public.studio_credit_transactions where composer_id=owner_id and action='referral_reward_reversal')<>10 then raise exception 'Owner reversal failed'; end if;
  if (select sum(amount) from public.studio_credit_transactions where composer_id=first_friend and action='referral_reward_reversal')<>5 then raise exception 'Friend reversal failed'; end if;
  if (select count(*) from public.studio_credit_transactions where composer_id=owner_id and action='referral_reward_reversal')<>1 then raise exception 'Duplicate refund reversal'; end if;

  -- Invalid/expired attribution and pre-existing paid accounts do not earn rewards.
  friend_id:=gen_random_uuid();
  insert into public.dccmusic_composers(id,name,slug,email,email_verified,created_at)
    values(friend_id,'Old QA '||friend_id,friend_id::text,friend_id||'@example.invalid',true,now()-interval '1 year');
  perform public.dcc_attribute_referral(friend_id,visit_id);
  if exists(select 1 from public.dcc_referrals where referee_id=friend_id) then raise exception 'Existing account attributed'; end if;
  if has_table_privilege('anon','public.dcc_referrals','select') or has_table_privilege('authenticated','public.dcc_referrals','insert') then raise exception 'Public ledger access'; end if;
  if has_function_privilege('anon','public.dcc_referral_dashboard(uuid,timestamptz,timestamptz,integer,integer)','execute') then raise exception 'Public dashboard RPC access'; end if;
end;
$$;
rollback;
select 'Referral integration assertions passed; all fixtures rolled back' as result;
