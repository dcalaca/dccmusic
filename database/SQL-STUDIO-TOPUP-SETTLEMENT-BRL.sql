-- Mantém o valor cobrado na moeda do cliente em amount/currency e registra,
-- separadamente, o valor bruto convertido pela adquirente para a conta DCC.
alter table public.studio_credit_topups
  add column if not exists settlement_amount numeric(12,2),
  add column if not exists settlement_currency text;

comment on column public.studio_credit_topups.settlement_amount is
  'Valor bruto convertido pela adquirente para a moeda de liquidação da conta.';

comment on column public.studio_credit_topups.settlement_currency is
  'Moeda do valor de liquidação, normalmente BRL para a conta DCC Music.';
