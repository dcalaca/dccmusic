-- Cria a tabela usada pelo botão "Quadro de avisos" no admin.
-- Execute este SQL no Supabase em SQL Editor > New query > Run.

create table if not exists public.site_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  message text not null default '',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.site_notices (id, title, message, is_active)
values (
  '00000000-0000-0000-0000-000000000001',
  '',
  '',
  false
)
on conflict (id) do nothing;

alter table public.site_notices enable row level security;

drop policy if exists "site_notices_public_read_active" on public.site_notices;
create policy "site_notices_public_read_active"
  on public.site_notices
  for select
  using (is_active = true);
