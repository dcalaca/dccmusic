-- Transcricao musical para compositores
-- Execute no Supabase SQL Editor antes de liberar a tela /transcricao-musical.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('studio-assets', 'studio-assets', false)
on conflict (id) do nothing;

create table if not exists public.music_transcriptions (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  source_type text not null check (source_type in ('studio_version', 'manual_upload')),
  source_hash text not null,
  studio_project_id uuid references public.studio_projects(id) on delete set null,
  studio_version_id uuid references public.studio_versions(id) on delete set null,
  title text not null,
  status text not null default 'completed' check (status in ('processing', 'completed', 'failed')),
  credits_charged integer not null default 0,
  provider_input_type text check (provider_input_type in ('song_id', 'upload_audio_id', 'url')),
  provider_input_value text,
  pdf_path text,
  pdf_storage_provider text default 'supabase',
  musicxml_path text,
  musicxml_storage_provider text default 'supabase',
  zip_path text,
  zip_storage_provider text default 'supabase',
  preview_text text,
  preview_payload jsonb not null default '{}'::jsonb,
  provider_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists idx_music_transcriptions_composer_source
  on public.music_transcriptions(composer_id, source_type, source_hash);

create index if not exists idx_music_transcriptions_composer_created
  on public.music_transcriptions(composer_id, created_at desc);

create index if not exists idx_music_transcriptions_studio_version
  on public.music_transcriptions(studio_version_id)
  where studio_version_id is not null;

alter table public.music_transcriptions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'music_transcriptions'
      and policyname = 'Block direct anon access to music_transcriptions'
  ) then
    create policy "Block direct anon access to music_transcriptions"
      on public.music_transcriptions
      for all
      using (false)
      with check (false);
  end if;
end $$;
