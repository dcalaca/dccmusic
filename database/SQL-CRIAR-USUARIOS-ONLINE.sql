create table if not exists public.dccmusic_user_presence (
  id uuid primary key default gen_random_uuid(),
  user_type text not null check (user_type in ('composer', 'site_user')),
  user_id uuid not null,
  name text,
  email text,
  path text,
  user_agent text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_type, user_id)
);

create index if not exists idx_dccmusic_user_presence_last_seen
  on public.dccmusic_user_presence (last_seen desc);

create index if not exists idx_dccmusic_user_presence_user_type
  on public.dccmusic_user_presence (user_type);

