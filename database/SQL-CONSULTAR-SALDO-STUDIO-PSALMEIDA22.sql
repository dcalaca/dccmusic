-- Conferência do saldo oficial usado pelo Studio IA/header.
-- Cliente: psalmeida22@gmail.com

with compositor as (
  select id, name, email
  from public.dccmusic_composers
  where lower(email) = lower('psalmeida22@gmail.com')
  order by created_at desc
  limit 1
),
recargas_pagas as (
  select
    coalesce(sum(credits), 0) as creditos_recargas_pagas,
    count(*) as qtd_recargas_pagas
  from public.studio_credit_topups t
  join compositor c on c.id = t.composer_id
  where t.status = 'paid'
    and t.month_key = to_char(now() at time zone 'UTC', 'YYYY-MM')
),
movimentos as (
  select
    coalesce(sum(case when action = 'credit_topup' then amount else 0 end), 0) as creditos_movimentacoes_recarga,
    coalesce(sum(case when action <> 'credit_topup' then amount else 0 end), 0) as creditos_usados
  from public.studio_credit_transactions t
  join compositor c on c.id = t.composer_id
  where t.month_key = to_char(now() at time zone 'UTC', 'YYYY-MM')
)
select
  c.id,
  c.name,
  c.email,
  r.qtd_recargas_pagas,
  r.creditos_recargas_pagas,
  m.creditos_movimentacoes_recarga,
  m.creditos_usados,
  greatest(r.creditos_recargas_pagas, m.creditos_movimentacoes_recarga) - m.creditos_usados as saldo_esperado,
  floor((greatest(r.creditos_recargas_pagas, m.creditos_movimentacoes_recarga) - m.creditos_usados) / 10) as musicas_possiveis
from compositor c
cross join recargas_pagas r
cross join movimentos m;
