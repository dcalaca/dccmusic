-- DCC Studio IA
-- Execute este SQL no Supabase SQL Editor antes de publicar a área Studio.

create extension if not exists pgcrypto;

-- Planos separados do Plano Ouro atual.
-- O slug antigo dcc-studio-ia fica inativo caso tenha sido criado em uma versão anterior.
update public.dccmusic_plans
set is_active = false, updated_at = now()
where slug = 'dcc-studio-ia';

insert into public.dccmusic_plans (
  name,
  slug,
  price,
  duration_months,
  description,
  features,
  featured_musics_per_month,
  has_priority_featured,
  has_gold_badge,
  has_premium_layout,
  is_active
)
values (
  'Studio Start',
  'studio-start',
  19.90,
  1,
  'Ideal para usuários iniciantes',
  '[
    "8 músicas/mês",
    "Letras IA ilimitadas",
    "Capas rápidas ilimitadas",
    "Salvar projetos musicais",
    "Preview de 20 segundos",
    "Publicação no DCC Music"
  ]'::jsonb,
  null,
  false,
  false,
  false,
  true
),
(
  'Studio Pro',
  'studio-pro',
  29.90,
  1,
  'Ideal para compositores ativos',
  '[
    "13 músicas/mês",
    "Letras IA ilimitadas",
    "Capas rápidas ilimitadas",
    "10 capas premium IA",
    "Player premium",
    "Download MP3",
    "Projetos ilimitados",
    "Publicação no DCC Music",
    "Prioridade de geração"
  ]'::jsonb,
  null,
  false,
  false,
  false,
  true
),
(
  'Studio Elite',
  'studio-elite',
  59.90,
  1,
  'Ideal para usuários avançados e criadores intensivos',
  '[
    "30 músicas/mês",
    "Letras IA ilimitadas",
    "Capas rápidas ilimitadas",
    "30 capas premium IA",
    "Downloads MP3",
    "Projetos ilimitados",
    "Prioridade máxima",
    "Selo Studio Elite",
    "Futuras funções antecipadas"
  ]'::jsonb,
  null,
  false,
  false,
  false,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  price = excluded.price,
  duration_months = excluded.duration_months,
  description = excluded.description,
  features = excluded.features,
  is_active = true,
  updated_at = now();

create table if not exists public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  title text not null,
  slug text not null unique,
  style text,
  mood text,
  structure text,
  line_count text,
  status text not null default 'draft' check (status in ('draft', 'generating', 'ready', 'published', 'archived')),
  favorite boolean not null default false,
  description text,
  public_slug text unique,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_lyrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  content text not null,
  prompt jsonb,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  provider text not null default 'sunoapi',
  provider_task_id text,
  provider_audio_id text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'first_ready', 'completed', 'failed')),
  callback_type text,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  generation_id uuid references public.studio_generations(id) on delete set null,
  version_name text not null default 'Versão 1',
  style text,
  audio_url text,
  stream_audio_url text,
  duration numeric,
  model text,
  provider_payload jsonb,
  is_current boolean not null default true,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_covers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  provider text not null default 'sunoapi',
  image_url text,
  image_path text,
  prompt text,
  is_premium boolean not null default false,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.studio_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  project_id uuid references public.studio_projects(id) on delete set null,
  action text not null,
  amount integer not null,
  month_key text not null,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.studio_video_requests (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  status text not null default 'payment_pending' check (status in ('payment_pending', 'requested', 'in_production', 'completed', 'cancelled', 'failed')),
  amount numeric(10,2) not null default 0,
  payment_gateway text,
  payment_preference_id text,
  payment_id text,
  provider_task_id text,
  video_url text,
  external_reference text unique,
  notes text,
  metadata jsonb,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  paid_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studio_video_requests
  add column if not exists provider_task_id text,
  add column if not exists video_url text,
  add column if not exists request_payload jsonb,
  add column if not exists response_payload jsonb,
  add column if not exists error_message text;

alter table public.studio_video_requests
  alter column amount set default 0;

create index if not exists idx_studio_projects_composer_created
  on public.studio_projects(composer_id, created_at desc);

create index if not exists idx_studio_projects_public_slug
  on public.studio_projects(public_slug);

create index if not exists idx_studio_versions_project_current
  on public.studio_versions(project_id, is_current);

create index if not exists idx_studio_credits_composer_month
  on public.studio_credit_transactions(composer_id, month_key);

create index if not exists idx_studio_video_requests_project_created
  on public.studio_video_requests(project_id, created_at desc);

alter table public.studio_projects enable row level security;
alter table public.studio_generations enable row level security;
alter table public.studio_lyrics enable row level security;
alter table public.studio_versions enable row level security;
alter table public.studio_covers enable row level security;
alter table public.studio_credit_transactions enable row level security;
alter table public.studio_video_requests enable row level security;

-- O backend do site usa service_role. Bloqueamos acesso anon direto às tabelas.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'studio_projects',
    'studio_generations',
    'studio_lyrics',
    'studio_versions',
    'studio_covers',
    'studio_credit_transactions',
    'studio_video_requests'
  ]
  loop
    execute format('drop policy if exists "Bloquear anon %I" on public.%I', table_name, table_name);
    execute format(
      'create policy "Bloquear anon %I" on public.%I for all to anon using (false) with check (false)',
      table_name,
      table_name
    );
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('studio-assets', 'studio-assets', false)
on conflict (id) do nothing;
