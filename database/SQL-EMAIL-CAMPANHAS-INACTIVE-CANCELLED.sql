-- Permite o modo de público inactive que o CRM já envia e o estado cancelled
-- usado para impedir que campanhas agendadas canceladas sejam retomadas pelo cron.
alter table public.admin_email_campaigns
  drop constraint if exists admin_email_campaigns_target_mode_check,
  add constraint admin_email_campaigns_target_mode_check
    check (target_mode in ('audience', 'pending_email', 'inactive'));

alter table public.admin_email_campaigns
  drop constraint if exists admin_email_campaigns_status_check,
  add constraint admin_email_campaigns_status_check
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'));
