-- Tabelas do DCC Studio Mixer (separação de stems + exports).
-- Rode no SQL Editor do Supabase.

create table if not exists public.studio_stem_jobs (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  project_id uuid null references public.studio_projects(id) on delete set null,
  source_version_id uuid null,
  source_audio_url text null,
  source_audio_path text null,
  source_audio_storage_provider text null,
  source_title text null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'failed')),
  provider text null check (provider is null or provider in ('suno', 'mureka')),
  provider_task_id text null,
  provider_payload jsonb null,
  stems jsonb not null default '[]'::jsonb,
  separation_charged boolean not null default false,
  separation_refunded boolean not null default false,
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_stem_jobs_composer_idx
  on public.studio_stem_jobs (composer_id, created_at desc);

create index if not exists studio_stem_jobs_provider_task_idx
  on public.studio_stem_jobs (provider_task_id);

create table if not exists public.studio_stem_exports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.studio_stem_jobs(id) on delete cascade,
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  project_id uuid null references public.studio_projects(id) on delete set null,
  version_id uuid null,
  mix_fingerprint text not null,
  export_charged boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists studio_stem_exports_job_fingerprint_uidx
  on public.studio_stem_exports (job_id, mix_fingerprint);

create index if not exists studio_stem_exports_composer_idx
  on public.studio_stem_exports (composer_id, created_at desc);

comment on table public.studio_stem_jobs is
  'Jobs de separação de stems do DCC Studio Mixer (Suno com fallback Mureka).';

comment on table public.studio_stem_exports is
  'Exports de mix do Mixer; mix_fingerprint evita cobrar de novo a mesma mix.';
