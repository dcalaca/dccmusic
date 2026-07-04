-- Modelos de comissão para parceiros / afiliados
-- Execute no Supabase SQL Editor antes de cadastrar parceiros com CPA.

alter table public.partners
  add column if not exists commission_model text not null default 'percentage',
  add column if not exists commission_payment_scope text not null default 'lifetime',
  add column if not exists cpa_studio_topup_amount numeric(10,2) not null default 0,
  add column if not exists cpa_subscription_amount numeric(10,2) not null default 0,
  add column if not exists commission_cap_amount numeric(10,2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partners_commission_model_check'
  ) then
    alter table public.partners
      add constraint partners_commission_model_check
      check (commission_model in ('percentage', 'cpa'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partners_commission_payment_scope_check'
  ) then
    alter table public.partners
      add constraint partners_commission_payment_scope_check
      check (commission_payment_scope in ('lifetime', 'first_purchase'));
  end if;
end $$;

update public.partners
set commission_model = 'percentage'
where commission_model is null;

update public.partners
set commission_payment_scope = 'lifetime'
where commission_payment_scope is null;
