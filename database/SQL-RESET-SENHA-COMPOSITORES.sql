-- Redefinição de senha de compositores via link mágico

create table if not exists public.composer_password_resets (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_composer_password_resets_composer
  on public.composer_password_resets(composer_id, created_at desc);

create index if not exists idx_composer_password_resets_token_hash
  on public.composer_password_resets(token_hash);

alter table public.composer_password_resets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'composer_password_resets'
      and policyname = 'Block direct anon access to composer_password_resets'
  ) then
    create policy "Block direct anon access to composer_password_resets"
      on public.composer_password_resets
      for all
      using (false)
      with check (false);
  end if;
end $$;
