-- Links magicos para campanhas de e-mail
-- Execute este arquivo no Supabase SQL Editor para ativar o botao que entra logado.

create extension if not exists pgcrypto;

create table if not exists public.admin_email_campaign_magic_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.admin_email_campaigns(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('composer', 'site_user')),
  recipient_id uuid not null,
  recipient_email text not null,
  destination_path text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_email_magic_links_campaign
  on public.admin_email_campaign_magic_links(campaign_id, created_at desc);

create index if not exists idx_admin_email_magic_links_recipient
  on public.admin_email_campaign_magic_links(recipient_type, recipient_id);

create index if not exists idx_admin_email_magic_links_unused
  on public.admin_email_campaign_magic_links(expires_at)
  where used_at is null;

alter table public.admin_email_campaign_magic_links enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_email_campaign_magic_links'
      and policyname = 'Block direct anon access to admin_email_campaign_magic_links'
  ) then
    create policy "Block direct anon access to admin_email_campaign_magic_links"
      on public.admin_email_campaign_magic_links
      for all
      using (false)
      with check (false);
  end if;
end $$;
