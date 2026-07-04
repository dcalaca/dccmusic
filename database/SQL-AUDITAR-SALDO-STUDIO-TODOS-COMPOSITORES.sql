-- Auditar saldo atual do Studio IA de todos os compositores
-- Mostra plano ativo, créditos do plano no mês, créditos avulsos/manuais,
-- créditos usados e saldo final estimado.

with active_subscriptions as (
  select distinct on (s.composer_id)
    s.composer_id,
    s.id as subscription_id,
    s.status,
    s.start_date,
    s.end_date,
    p.name as plan_name,
    p.slug as plan_slug,
    case
      when lower(coalesce(p.name, '') || ' ' || coalesce(p.slug, '')) like '%elite%' then 540
      when lower(coalesce(p.name, '') || ' ' || coalesce(p.slug, '')) like '%pro%' then 230
      when lower(coalesce(p.name, '') || ' ' || coalesce(p.slug, '')) like '%studio%' then 130
      else 0
    end as plan_monthly_credits
  from public.dccmusic_subscriptions s
  join public.dccmusic_plans p on p.id = s.plan_id
  where s.status = 'active'
    and s.end_date >= now()
    and (
      p.slug in ('studio-start', 'studio-pro', 'studio-elite', 'dcc-studio-ia')
      or lower(coalesce(p.name, '') || ' ' || coalesce(p.slug, '')) like '%dcc studio%'
      or lower(coalesce(p.name, '') || ' ' || coalesce(p.slug, '')) like '%studio ia%'
      or lower(coalesce(p.name, '') || ' ' || coalesce(p.slug, '')) like '%studio%'
    )
  order by s.composer_id, s.end_date desc
),
paid_topups as (
  select
    composer_id,
    coalesce(sum(greatest(coalesce(credits, 0), 0)), 0)::integer as topup_credits
  from public.studio_credit_topups
  where status = 'paid'
  group by composer_id
),
manual_credits as (
  select
    composer_id,
    coalesce(sum(greatest(coalesce(amount, 0), 0)), 0)::integer as manual_credits
  from public.studio_credit_transactions
  where action = 'manual_credit'
  group by composer_id
),
used_topup_credits as (
  select
    composer_id,
    coalesce(sum(greatest(coalesce(amount, 0), 0)), 0)::integer as used_topup_credits
  from public.studio_credit_transactions
  where action = 'music_generation'
    and metadata->>'topup' = 'true'
  group by composer_id
),
month_transactions as (
  select
    composer_id,
    action,
    amount,
    metadata
  from public.studio_credit_transactions
  where month_key = to_char(timezone('UTC', now()), 'YYYY-MM')
),
month_generation_count as (
  select
    composer_id,
    count(*)::integer as generation_count
  from public.studio_generations
  where created_at >= date_trunc('month', timezone('UTC', now()))
    and created_at < date_trunc('month', timezone('UTC', now())) + interval '1 month'
    and status <> 'failed'
  group by composer_id
),
month_usage as (
  select
    c.id as composer_id,
    coalesce((
      select count(*)::integer
      from month_transactions mt
      where mt.composer_id = c.id
        and mt.action = 'music_generation'
        and coalesce(mt.metadata->>'topup', 'false') <> 'true'
    ), 0) as plan_music_generation_transactions,
    coalesce((
      select sum(greatest(coalesce(mt.amount, 0), 0))::integer
      from month_transactions mt
      where mt.composer_id = c.id
        and mt.action = 'music_generation'
        and coalesce(mt.metadata->>'topup', 'false') <> 'true'
    ), 0) as plan_music_credit_transactions,
    coalesce((
      select count(*)::integer
      from month_transactions mt
      where mt.composer_id = c.id
        and mt.action = 'free_music_generation'
    ), 0) as free_music_generation_transactions,
    coalesce((
      select sum(greatest(coalesce(mt.amount, 0), 0))::integer
      from month_transactions mt
      where mt.composer_id = c.id
        and mt.action not in (
          'music_generation',
          'free_music_generation',
          'credit_topup',
          'credit_topup_refund',
          'manual_credit'
        )
    ), 0) as other_used
  from public.dccmusic_composers c
),
balances as (
  select
    c.id,
    c.name,
    c.email,
    c.slug,
    c.created_at,
    coalesce(a.plan_name, 'Sem plano Studio ativo') as studio_plan,
    coalesce(a.plan_slug, '') as studio_plan_slug,
    coalesce(a.plan_monthly_credits, 0) as plan_credits_month,
    coalesce(pt.topup_credits, 0) as topup_credits,
    coalesce(mc.manual_credits, 0) as manual_credits,
    greatest(
      coalesce(pt.topup_credits, 0) + coalesce(mc.manual_credits, 0) - coalesce(utc.used_topup_credits, 0),
      0
    ) as wallet_credits,
    coalesce(mgc.generation_count, 0) as generation_count_month,
    greatest(
      coalesce(mgc.generation_count, 0)
      - coalesce(mu.plan_music_generation_transactions, 0)
      - coalesce(mu.free_music_generation_transactions, 0),
      0
    ) as untracked_music_generations,
    coalesce(mu.other_used, 0) as other_used,
    greatest(
      coalesce(mu.plan_music_credit_transactions, 0),
      (
        coalesce(mu.plan_music_generation_transactions, 0)
        + greatest(
          coalesce(mgc.generation_count, 0)
          - coalesce(mu.plan_music_generation_transactions, 0)
          - coalesce(mu.free_music_generation_transactions, 0),
          0
        )
      ) * 10
    ) as music_used_credits
  from public.dccmusic_composers c
  left join active_subscriptions a on a.composer_id = c.id
  left join paid_topups pt on pt.composer_id = c.id
  left join manual_credits mc on mc.composer_id = c.id
  left join used_topup_credits utc on utc.composer_id = c.id
  left join month_generation_count mgc on mgc.composer_id = c.id
  left join month_usage mu on mu.composer_id = c.id
)
select
  name,
  email,
  '/' || slug as slug,
  studio_plan,
  plan_credits_month,
  topup_credits,
  manual_credits,
  wallet_credits,
  generation_count_month,
  music_used_credits,
  other_used,
  greatest(
    plan_credits_month + wallet_credits - music_used_credits - other_used,
    0
  ) as saldo_atual_creditos,
  floor(greatest(
    plan_credits_month + wallet_credits - music_used_credits - other_used,
    0
  ) / 10) as saldo_atual_musicas,
  created_at
from balances
order by saldo_atual_creditos desc, name asc;
