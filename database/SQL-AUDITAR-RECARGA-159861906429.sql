-- Auditoria da recarga Mercado Pago 159861906429.
-- Objetivo: conferir se o sistema creditou corretamente, se cada musica consumiu 10 creditos
-- e se o saldo zerou apenas depois da contestacao/estorno no Mercado Pago.
--
-- Como usar no Supabase:
-- 1. Abra o painel do Supabase.
-- 2. Clique em SQL Editor.
-- 3. Cole este arquivo inteiro.
-- 4. Clique em Run.

-- 1) Dados do compositor encontrado pelo e-mail do print do Mercado Pago.
select
  id,
  name,
  email,
  created_at
from public.dccmusic_composers
where lower(email) in (
  lower('alanjonsr3@gmail.com'),
  lower('psalmeida22@gmail.com')
)
order by created_at desc;

-- 2) Recarga especifica do Mercado Pago.
-- Se status estiver refunded/cancelled/failed, ela nao deve contar como saldo comprado.
select
  t.id,
  c.name as compositor,
  c.email,
  t.status,
  t.amount,
  t.credits,
  t.music_quantity,
  t.payment_id,
  t.payment_preference_id,
  t.external_reference,
  t.created_at,
  t.paid_at,
  t.updated_at,
  t.metadata->'mercadopago_payment'->>'status' as mp_status,
  t.metadata->'mercadopago_payment'->>'status_detail' as mp_status_detail
from public.studio_credit_topups t
join public.dccmusic_composers c on c.id = t.composer_id
where t.payment_id = '159861906429'
   or t.external_reference ilike '%159861906429%'
   or lower(c.email) in (lower('alanjonsr3@gmail.com'), lower('psalmeida22@gmail.com'))
order by t.created_at desc;

-- 3) Linha do tempo das movimentacoes de creditos do compositor.
-- saldo_pelo_extrato_bruto mostra o que aconteceu cronologicamente:
--   credit_topup soma, music_generation subtrai.
-- Se o pagamento foi depois estornado, a recarga deixa de ser saldo valido,
-- mas esta linha confirma se, no momento da compra, o credito entrou.
with compositores as (
  select id, name, email
  from public.dccmusic_composers
  where lower(email) in (
    lower('alanjonsr3@gmail.com'),
    lower('psalmeida22@gmail.com')
  )
),
movimentos as (
  select
    tr.created_at,
    c.name,
    c.email,
    tr.action,
    tr.description,
    tr.amount,
    tr.project_id,
    tr.metadata->>'paymentId' as payment_id,
    tr.metadata->>'topupId' as topup_id,
    top.status as topup_status,
    case
      when tr.action = 'credit_topup' then tr.amount
      else -tr.amount
    end as delta_creditos
  from public.studio_credit_transactions tr
  join compositores c on c.id = tr.composer_id
  left join public.studio_credit_topups top on top.id::text = tr.metadata->>'topupId'
)
select
  created_at,
  name,
  email,
  action,
  description,
  amount,
  delta_creditos,
  sum(delta_creditos) over (
    partition by email
    order by created_at asc
    rows between unbounded preceding and current row
  ) as saldo_pelo_extrato_bruto,
  payment_id,
  topup_id,
  topup_status,
  project_id
from movimentos
order by email, created_at asc;

-- 4) Saldo oficial atual usado pelo sistema.
-- Aqui so entram recargas que continuam como paid.
-- Se a recarga foi estornada/contestada, creditos_recargas_pagas fica 0
-- e o saldo oficial tambem fica 0, mesmo que exista historico antigo de +creditos.
with compositores as (
  select id, name, email
  from public.dccmusic_composers
  where lower(email) in (
    lower('alanjonsr3@gmail.com'),
    lower('psalmeida22@gmail.com')
  )
),
recargas_pagas as (
  select
    c.id as composer_id,
    coalesce(sum(t.credits), 0) as creditos_recargas_pagas,
    count(*) as qtd_recargas_pagas
  from compositores c
  left join public.studio_credit_topups t
    on t.composer_id = c.id
   and t.status = 'paid'
  group by c.id
),
usos as (
  select
    c.id as composer_id,
    coalesce(sum(case when tr.action <> 'credit_topup' then tr.amount else 0 end), 0) as creditos_usados
  from compositores c
  left join public.studio_credit_transactions tr on tr.composer_id = c.id
  group by c.id
)
select
  c.name,
  c.email,
  r.qtd_recargas_pagas,
  r.creditos_recargas_pagas,
  u.creditos_usados,
  greatest(0, r.creditos_recargas_pagas - u.creditos_usados) as saldo_oficial_atual,
  floor(greatest(0, r.creditos_recargas_pagas - u.creditos_usados) / 10) as musicas_possiveis
from compositores c
join recargas_pagas r on r.composer_id = c.id
join usos u on u.composer_id = c.id
order by c.email;
