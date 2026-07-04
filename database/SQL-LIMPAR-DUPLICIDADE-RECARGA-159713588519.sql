-- Limpa duplicidade de crédito da recarga Mercado Pago 159713588519.
-- Mantém uma única movimentação +10 créditos e remove repetições da mesma recarga.

with duplicadas as (
  select
    id,
    row_number() over (
      partition by composer_id, metadata->>'paymentId', metadata->>'topupId'
      order by created_at asc, id asc
    ) as ordem
  from public.studio_credit_transactions
  where action = 'credit_topup'
    and metadata->>'paymentId' = '159713588519'
)
delete from public.studio_credit_transactions
where id in (
  select id
  from duplicadas
  where ordem > 1
);

-- Conferência: depois de rodar, deve aparecer somente 1 linha.
select
  id,
  composer_id,
  action,
  amount,
  description,
  metadata,
  created_at
from public.studio_credit_transactions
where action = 'credit_topup'
  and metadata->>'paymentId' = '159713588519'
order by created_at desc;
