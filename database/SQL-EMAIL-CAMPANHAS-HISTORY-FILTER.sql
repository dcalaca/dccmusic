-- Permite excluir da audiência quem teve um e-mail de campanha aceito no período escolhido.
alter table public.admin_email_campaigns
  add column if not exists exclude_previously_sent boolean not null default false,
  add column if not exists sent_filter_from timestamptz,
  add column if not exists sent_filter_to timestamptz;

comment on column public.admin_email_campaigns.exclude_previously_sent is
  'Quando true, remove destinatários com entrega de campanha aceita pelo provedor entre sent_filter_from e sent_filter_to.';
comment on column public.admin_email_campaigns.sent_filter_from is
  'Início inclusivo do período usado para excluir destinatários previamente enviados.';
comment on column public.admin_email_campaigns.sent_filter_to is
  'Fim inclusivo do período usado para excluir destinatários previamente enviados.';
