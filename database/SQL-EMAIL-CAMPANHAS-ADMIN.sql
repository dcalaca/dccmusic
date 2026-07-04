-- Campanhas de e-mail do Admin DCC Music
-- Execute este arquivo no Supabase SQL Editor antes de usar /admin/email-campanhas.

create extension if not exists pgcrypto;

create table if not exists public.admin_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  preview text,
  body text not null,
  cta_label text,
  cta_url text,
  audience text not null default 'all'
    check (audience in ('all', 'composers', 'site_users')),
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'paused')),
  scheduled_at timestamptz,
  recurring_day smallint
    check (recurring_day is null or (recurring_day between 1 and 28)),
  recurring_enabled boolean not null default false,
  last_run_at timestamptz,
  next_run_at timestamptz,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_email_campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.admin_email_campaigns(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('composer', 'site_user')),
  recipient_id uuid,
  recipient_email text not null,
  recipient_name text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_email_opt_outs (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  recipient_type text check (recipient_type is null or recipient_type in ('composer', 'site_user')),
  recipient_id uuid,
  campaign_id uuid references public.admin_email_campaigns(id) on delete set null,
  user_agent text,
  ip_address text,
  opted_out_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_admin_email_campaign_deliveries_unique
  on public.admin_email_campaign_deliveries(campaign_id, lower(recipient_email));

create index if not exists idx_admin_email_opt_outs_email
  on public.admin_email_opt_outs(lower(email));

create index if not exists idx_admin_email_campaigns_status_schedule
  on public.admin_email_campaigns(status, scheduled_at, next_run_at);

create index if not exists idx_admin_email_campaign_deliveries_campaign
  on public.admin_email_campaign_deliveries(campaign_id, status, created_at);

alter table public.admin_email_campaigns enable row level security;
alter table public.admin_email_campaign_deliveries enable row level security;
alter table public.admin_email_opt_outs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_email_campaigns'
      and policyname = 'Block direct anon access to admin_email_campaigns'
  ) then
    create policy "Block direct anon access to admin_email_campaigns"
      on public.admin_email_campaigns
      for all
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_email_campaign_deliveries'
      and policyname = 'Block direct anon access to admin_email_campaign_deliveries'
  ) then
    create policy "Block direct anon access to admin_email_campaign_deliveries"
      on public.admin_email_campaign_deliveries
      for all
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_email_opt_outs'
      and policyname = 'Block direct anon access to admin_email_opt_outs'
  ) then
    create policy "Block direct anon access to admin_email_opt_outs"
      on public.admin_email_opt_outs
      for all
      using (false)
      with check (false);
  end if;
end $$;
