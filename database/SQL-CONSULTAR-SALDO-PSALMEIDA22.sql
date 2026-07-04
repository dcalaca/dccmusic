-- Consulta de saldo e extrato Studio IA antes de qualquer limpeza.
-- Cliente: psalmeida22@gmail.com

with compositor as (
  select
    id,
    name,
    email,
    is_premium,
    has_active_subscription,
    subscription_expires_at,
    created_at
  from public.dccmusic_composers
  where lower(email) = lower('psalmeida22@gmail.com')
  order by created_at desc
  limit 1
),
movimentos as (
  select
    t.id,
    t.composer_id,
    t.action,
    t.amount,
    t.description,
    t.metadata,
    t.metadata->>'paymentId' as payment_id,
    t.metadata->>'topupId' as topup_id,
    t.created_at
  from public.studio_credit_transactions t
  join compositor c on c.id = t.composer_id
),
resumo_creditos as (
  select
    coalesce(sum(case when action = 'credit_topup' then amount else 0 end), 0) as creditos_comprados,
    coalesce(sum(case when action <> 'credit_topup' then amount else 0 end), 0) as creditos_usados,
    coalesce(sum(case when action = 'credit_topup' then amount else -amount end), 0) as saldo_creditos
  from movimentos
),
recargas as (
  select
    r.id,
    r.composer_id,
    r.music_quantity,
    r.credits,
    r.amount,
    r.status,
    r.payment_id,
    r.external_reference,
    r.paid_at,
    r.created_at
  from public.studio_credit_topups r
  join compositor c on c.id = r.composer_id
),
duplicidades as (
  select
    coalesce(payment_id, 'sem paymentId') as payment_id,
    coalesce(topup_id, 'sem topupId') as topup_id,
    count(*) as quantidade_linhas,
    sum(amount) as creditos_lancados
  from movimentos
  where action = 'credit_topup'
  group by coalesce(payment_id, 'sem paymentId'), coalesce(topup_id, 'sem topupId')
  having count(*) > 1
)
select
  '1_COMPOSITOR' as bloco,
  c.id::text as id,
  c.name as nome,
  c.email,
  null::text as detalhe,
  null::numeric as valor,
  c.created_at as data
from compositor c

union all

select
  '2_RESUMO_SALDO' as bloco,
  null::text as id,
  'Saldo Studio IA' as nome,
  null::text as email,
  'Comprados: ' || r.creditos_comprados ||
  ' | Usados: ' || r.creditos_usados ||
  ' | Saldo: ' || r.saldo_creditos ||
  ' | Músicas possíveis: ' || floor(r.saldo_creditos / 10) as detalhe,
  r.saldo_creditos::numeric as valor,
  now() as data
from resumo_creditos r

union all

select
  '3_RECARGAS' as bloco,
  r.id::text as id,
  'Recarga ' || r.status as nome,
  null::text as email,
  'Pagamento: ' || coalesce(r.payment_id, 'sem payment_id') ||
  ' | Músicas: ' || r.music_quantity ||
  ' | Créditos: ' || r.credits ||
  ' | Referência: ' || coalesce(r.external_reference, 'sem referência') as detalhe,
  r.amount::numeric as valor,
  coalesce(r.paid_at, r.created_at) as data
from recargas r

union all

select
  '4_MOVIMENTOS_CREDITOS' as bloco,
  m.id::text as id,
  m.action as nome,
  null::text as email,
  coalesce(m.description, '') ||
  ' | paymentId: ' || coalesce(m.payment_id, 'sem paymentId') ||
  ' | topupId: ' || coalesce(m.topup_id, 'sem topupId') as detalhe,
  m.amount::numeric as valor,
  m.created_at as data
from movimentos m

union all

select
  '5_POSSIVEIS_DUPLICIDADES' as bloco,
  null::text as id,
  'Duplicidade de recarga' as nome,
  null::text as email,
  'paymentId: ' || d.payment_id ||
  ' | topupId: ' || d.topup_id ||
  ' | linhas: ' || d.quantidade_linhas ||
  ' | créditos lançados: ' || d.creditos_lancados as detalhe,
  d.creditos_lancados::numeric as valor,
  now() as data
from duplicidades d

order by bloco, data desc;
