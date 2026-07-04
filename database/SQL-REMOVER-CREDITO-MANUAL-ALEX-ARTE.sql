-- Remover o crédito manual de 23 músicas lançado para Alex Arte
-- Use este SQL se o crédito manual foi lançado apenas porque o plano Studio Pro
-- ainda não aparecia corretamente no extrato.
--
-- Remove SOMENTE a linha com este idempotencyKey:
-- manual-credit:alexrlima2016@gmail.com:230:2026-05-24

do $$
declare
  v_deleted_count integer;
begin
  delete from public.studio_credit_transactions t
  using public.dccmusic_composers c
  where t.composer_id = c.id
    and lower(c.email) = lower('alexrlima2016@gmail.com')
    and c.slug = 'alex-arte'
    and t.action = 'manual_credit'
    and t.metadata->>'idempotencyKey' = 'manual-credit:alexrlima2016@gmail.com:230:2026-05-24';

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    raise notice 'Nenhum crédito manual encontrado para remover.';
  else
    raise notice 'Crédito manual removido com sucesso. Linhas removidas: %', v_deleted_count;
  end if;
end $$;

-- Conferência: depois de rodar, esta consulta deve voltar vazia.
select
  c.name,
  c.email,
  c.slug,
  t.action,
  t.amount as creditos,
  t.description,
  t.created_at,
  t.metadata
from public.studio_credit_transactions t
join public.dccmusic_composers c on c.id = t.composer_id
where lower(c.email) = lower('alexrlima2016@gmail.com')
  and c.slug = 'alex-arte'
  and t.action = 'manual_credit'
  and t.metadata->>'idempotencyKey' = 'manual-credit:alexrlima2016@gmail.com:230:2026-05-24';
