-- Confirmação de e-mail de compositores via link mágico

alter table public.dccmusic_composers
  add column if not exists email_verified boolean not null default false,
  add column if not exists email_verified_at timestamptz;

-- Não bloquear usuários antigos: quem já tinha e-mail antes desta função entra como verificado.
update public.dccmusic_composers
set
  email_verified = true,
  email_verified_at = coalesce(email_verified_at, now())
where email is not null
  and email_verified = false;

create table if not exists public.composer_email_verifications (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_composer_email_verifications_composer
  on public.composer_email_verifications(composer_id, created_at desc);

create index if not exists idx_composer_email_verifications_token_hash
  on public.composer_email_verifications(token_hash);

alter table public.composer_email_verifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'composer_email_verifications'
      and policyname = 'Block direct anon access to composer_email_verifications'
  ) then
    create policy "Block direct anon access to composer_email_verifications"
      on public.composer_email_verifications
      for all
      using (false)
      with check (false);
  end if;
end $$;
