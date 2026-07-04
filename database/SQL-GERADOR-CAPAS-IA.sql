-- Gerador de Capas IA - Plano Ouro
-- Execute este SQL no Supabase SQL Editor antes de publicar a funcionalidade.

create table if not exists public.dccmusic_ai_covers (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  title text,
  input_text text not null,
  music_style text not null,
  visual_style text not null,
  prompt text not null,
  image_path text not null,
  image_mime text not null default 'image/png',
  month_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_dccmusic_ai_covers_composer_created
  on public.dccmusic_ai_covers(composer_id, created_at desc);

create index if not exists idx_dccmusic_ai_covers_composer_month
  on public.dccmusic_ai_covers(composer_id, month_key);

alter table public.dccmusic_ai_covers enable row level security;

-- O site usa SUPABASE_SERVICE_ROLE_KEY no backend, então as policies abaixo
-- servem como segurança extra caso algum acesso público tente ler a tabela.
drop policy if exists "Bloquear acesso anonimo a capas IA" on public.dccmusic_ai_covers;
create policy "Bloquear acesso anonimo a capas IA"
  on public.dccmusic_ai_covers
  for all
  to anon
  using (false)
  with check (false);

-- Bucket privado para guardar PNGs gerados pela IA.
insert into storage.buckets (id, name, public)
values ('ai-covers', 'ai-covers', false)
on conflict (id) do nothing;
