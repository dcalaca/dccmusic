-- PARE IMEDIATAMENTE qualquer campanha em envio.
-- Execute no Supabase SQL Editor se a campanha ainda estiver "Enviando".

update public.admin_email_campaigns
set
  status = 'paused',
  next_run_at = null,
  updated_at = now()
where status in ('sending', 'scheduled')
  and name ilike '%partitura%';

-- Conferir:
select id, name, status, sent_count, failed_count, last_run_at, next_run_at
from public.admin_email_campaigns
order by updated_at desc
limit 10;
