-- Logs de e-mails transacionais da DCC Music
-- Ajuda a evitar envios duplicados em webhooks, cron jobs e callbacks.

create table if not exists public.dccmusic_email_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  category text not null,
  recipient text not null,
  subject text not null,
  provider_id text,
  metadata jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_dccmusic_email_events_category
  on public.dccmusic_email_events(category, sent_at desc);

create index if not exists idx_dccmusic_email_events_recipient
  on public.dccmusic_email_events(recipient, sent_at desc);

alter table public.dccmusic_email_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dccmusic_email_events'
      and policyname = 'Block direct anon access to dccmusic_email_events'
  ) then
    create policy "Block direct anon access to dccmusic_email_events"
      on public.dccmusic_email_events
      for all
      using (false)
      with check (false);
  end if;
end $$;
