-- Backup interno dos áudios do Studio IA
-- Execute no Supabase SQL Editor antes de rodar o backup das músicas antigas.

insert into storage.buckets (id, name, public)
values ('studio-assets', 'studio-assets', false)
on conflict (id) do nothing;

alter table public.studio_versions
  add column if not exists audio_path text,
  add column if not exists stream_audio_path text,
  add column if not exists audio_storage_provider text default 'supabase',
  add column if not exists stream_audio_storage_provider text default 'supabase',
  add column if not exists audio_backup_status text default 'pending',
  add column if not exists audio_backup_error text,
  add column if not exists audio_backed_up_at timestamptz;

create index if not exists idx_studio_versions_audio_backup_status
  on public.studio_versions(audio_backup_status);

create index if not exists idx_studio_versions_audio_path
  on public.studio_versions(audio_path);

update public.studio_versions
set audio_backup_status = 'pending'
where (audio_url is not null or stream_audio_url is not null)
  and audio_path is null
  and coalesce(audio_backup_status, 'pending') <> 'backed_up';
