-- ============================================
-- Sistema Minhas Vozes - DCC Studio IA
-- ============================================

create table if not exists public.studio_voice_profiles (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  display_name text not null,
  status text not null default 'source_uploaded' check (
    status in (
      'source_uploaded',
      'validation_processing',
      'awaiting_verification',
      'voice_processing',
      'ready',
      'failed',
      'archived'
    )
  ),
  source_audio_path text,
  source_audio_storage_provider text,
  source_audio_content_type text,
  source_audio_size_bytes integer,
  verify_audio_path text,
  verify_audio_storage_provider text,
  verify_audio_content_type text,
  verify_audio_size_bytes integer,
  vocal_start_s integer not null default 0,
  vocal_end_s integer not null default 20,
  language text not null default 'pt',
  singer_skill_level text not null default 'beginner',
  validation_task_id text,
  voice_generation_task_id text,
  validate_info text,
  voice_id text,
  is_available boolean not null default false,
  error_message text,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_studio_voice_profiles_composer_id
  on public.studio_voice_profiles(composer_id);

create index if not exists idx_studio_voice_profiles_status
  on public.studio_voice_profiles(status);

create index if not exists idx_studio_voice_profiles_validation_task_id
  on public.studio_voice_profiles(validation_task_id);

create index if not exists idx_studio_voice_profiles_generation_task_id
  on public.studio_voice_profiles(voice_generation_task_id);

create table if not exists public.studio_inspiration_requests (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  source_project_id uuid references public.studio_projects(id) on delete set null,
  source_version_id uuid references public.studio_versions(id) on delete set null,
  target_project_id uuid references public.studio_projects(id) on delete set null,
  status text not null default 'created' check (
    status in ('created', 'processing', 'completed', 'failed')
  ),
  provider text not null default 'sunoapi',
  provider_task_id text,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_studio_inspiration_requests_composer_id
  on public.studio_inspiration_requests(composer_id);

create index if not exists idx_studio_inspiration_requests_provider_task_id
  on public.studio_inspiration_requests(provider_task_id);
