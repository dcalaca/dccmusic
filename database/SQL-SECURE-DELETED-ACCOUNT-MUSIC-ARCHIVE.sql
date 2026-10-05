-- Secure retention for deleted Studio IA accounts.
-- Personal account identity is blocked only by irreversible SHA-256 identifiers.
-- Archived music is detached from composer rows and is NOT training-eligible by default.

create table if not exists public.composer_account_deletion_blocks (
  id uuid primary key default gen_random_uuid(),
  email_hash text not null unique,
  google_sub_hash text unique,
  source text not null default 'unknown',
  blocked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.composer_account_deletion_blocks enable row level security;
revoke all on table public.composer_account_deletion_blocks from anon, authenticated;

create table if not exists public.deleted_studio_music_archive (
  id uuid primary key default gen_random_uuid(),
  deletion_key uuid not null,
  original_project_id uuid,
  original_version_id uuid not null unique,
  archived_at timestamptz not null default now(),
  training_eligible boolean not null default false,
  retention_reason text not null default 'account_deletion_archive',
  project_snapshot jsonb not null default '{}'::jsonb,
  version_snapshot jsonb not null default '{}'::jsonb,
  generation_snapshot jsonb,
  lyrics_snapshot jsonb not null default '[]'::jsonb,
  audio_path text,
  stream_audio_path text,
  audio_storage_provider text,
  stream_audio_storage_provider text,
  audio_url text,
  stream_audio_url text
);

create index if not exists deleted_studio_music_archive_deletion_key_idx
  on public.deleted_studio_music_archive (deletion_key);
create index if not exists deleted_studio_music_archive_archived_at_idx
  on public.deleted_studio_music_archive (archived_at desc);
create index if not exists deleted_studio_music_archive_training_eligible_idx
  on public.deleted_studio_music_archive (training_eligible)
  where training_eligible = true;

alter table public.deleted_studio_music_archive enable row level security;
revoke all on table public.deleted_studio_music_archive from anon, authenticated;
