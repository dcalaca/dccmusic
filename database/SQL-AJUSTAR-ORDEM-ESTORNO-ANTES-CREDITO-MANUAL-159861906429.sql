-- Ajusta apenas a ordem visual/historica do extrato.
-- Coloca o estorno da recarga 159861906429 alguns segundos antes do credito manual.
--
-- Isso NAO altera saldo, valor, status ou creditos.
-- Altera somente created_at da movimentacao credit_topup_refund.
--
-- Como usar no Supabase:
-- 1. Abra o SQL Editor.
-- 2. Cole este arquivo inteiro.
-- 3. Clique em Run.

with alvo as (
  select
    refund.id as refund_transaction_id,
    manual.created_at as manual_credit_created_at
  from public.studio_credit_transactions refund
  join public.dccmusic_composers c on c.id = refund.composer_id
  join lateral (
    select tr.created_at
    from public.studio_credit_transactions tr
    where tr.composer_id = refund.composer_id
      and tr.action = 'manual_credit'
    order by tr.created_at desc
    limit 1
  ) manual on true
  where lower(c.email) = lower('alanjonsr3@gmail.com')
    and refund.action = 'credit_topup_refund'
    and refund.metadata->>'paymentId' = '159861906429'
  limit 1
)
update public.studio_credit_transactions tr
set created_at = alvo.manual_credit_created_at - interval '5 seconds'
from alvo
where tr.id = alvo.refund_transaction_id;

-- Conferencia.
select
  tr.created_at,
  tr.action,
  tr.description,
  tr.amount,
  tr.metadata->>'paymentId' as payment_id
from public.studio_credit_transactions tr
join public.dccmusic_composers c on c.id = tr.composer_id
where lower(c.email) = lower('alanjonsr3@gmail.com')
order by tr.created_at desc;
