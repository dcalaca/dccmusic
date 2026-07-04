-- Recarga avulsa de créditos para DCC Studio IA
-- Rode este script no SQL Editor do Supabase antes de liberar a função em produção.

create table if not exists public.studio_credit_topups (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  package_slug text not null,
  music_quantity integer not null,
  credits integer not null,
  amount numeric(10,2) not null,
  currency text not null default 'BRL',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  payment_gateway text,
  payment_preference_id text,
  payment_id text,
  external_reference text unique not null,
  month_key text not null,
  metadata jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_studio_credit_topups_composer_created
  on public.studio_credit_topups(composer_id, created_at desc);

create index if not exists idx_studio_credit_topups_external_reference
  on public.studio_credit_topups(external_reference);

alter table public.studio_credit_topups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'studio_credit_topups'
      and policyname = 'Block direct anon access to studio_credit_topups'
  ) then
    create policy "Block direct anon access to studio_credit_topups"
      on public.studio_credit_topups
      for all
      using (false)
      with check (false);
  end if;
end $$;
