-- ============================================
-- Sistema de Parceiros / Afiliados - DCC Music
-- Evolui Links Rastreáveis sem quebrar o sistema atual
-- ============================================

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  password_hash text,
  requires_password_change boolean not null default true,
  display_name text not null,
  partner_code text not null unique,
  commission_percentage numeric(5,2) not null default 10.00,
  commission_model text not null default 'percentage' check (commission_model in ('percentage', 'cpa')),
  commission_payment_scope text not null default 'lifetime' check (commission_payment_scope in ('lifetime', 'first_purchase')),
  cpa_studio_topup_amount numeric(10,2) not null default 0,
  cpa_subscription_amount numeric(10,2) not null default 0,
  commission_cap_amount numeric(10,2),
  attribution_window_days integer not null default 15,
  customer_lifetime_months integer not null default 6,
  tracked_link_id uuid references public.dccmusic_tracked_links(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partners
  alter column user_id drop not null,
  add column if not exists email text,
  add column if not exists password_hash text,
  add column if not exists requires_password_change boolean not null default true,
  add column if not exists customer_lifetime_months integer not null default 6,
  add column if not exists commission_model text not null default 'percentage',
  add column if not exists commission_payment_scope text not null default 'lifetime',
  add column if not exists cpa_studio_topup_amount numeric(10,2) not null default 0,
  add column if not exists cpa_subscription_amount numeric(10,2) not null default 0,
  add column if not exists commission_cap_amount numeric(10,2);

create index if not exists idx_partners_user_id on public.partners(user_id);
create index if not exists idx_partners_email on public.partners(email);
create unique index if not exists idx_partners_email_unique on public.partners(email) where email is not null;
create index if not exists idx_partners_partner_code on public.partners(partner_code);
create index if not exists idx_partners_is_active on public.partners(is_active);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partners_commission_model_check'
  ) then
    alter table public.partners
      add constraint partners_commission_model_check
      check (commission_model in ('percentage', 'cpa'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partners_commission_payment_scope_check'
  ) then
    alter table public.partners
      add constraint partners_commission_payment_scope_check
      check (commission_payment_scope in ('lifetime', 'first_purchase'));
  end if;
end $$;

alter table public.dccmusic_composers
  add column if not exists role text not null default 'user',
  add column if not exists partner_id uuid references public.partners(id) on delete set null,
  add column if not exists partner_attributed_at timestamptz,
  add column if not exists partner_expires_at timestamptz,
  add column if not exists partner_lifetime_expires_at timestamptz;

alter table public.dccmusic_site_users
  add column if not exists role text not null default 'user',
  add column if not exists partner_id uuid references public.partners(id) on delete set null,
  add column if not exists partner_attributed_at timestamptz,
  add column if not exists partner_expires_at timestamptz,
  add column if not exists partner_lifetime_expires_at timestamptz;

alter table public.dccmusic_tracked_links
  add column if not exists partner_id uuid references public.partners(id) on delete set null,
  add column if not exists link_type text not null default 'tracked';

create table if not exists public.tracking_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  partner_id uuid references public.partners(id) on delete set null,
  link_id uuid references public.dccmusic_tracked_links(id) on delete set null,
  ip inet,
  user_agent text,
  is_human boolean not null default false,
  human_score integer not null default 0,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index if not exists idx_tracking_sessions_partner_id on public.tracking_sessions(partner_id);
create index if not exists idx_tracking_sessions_session_id on public.tracking_sessions(session_id);
create index if not exists idx_tracking_sessions_last_activity on public.tracking_sessions(last_activity_at desc);

create table if not exists public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  partner_id uuid references public.partners(id) on delete set null,
  user_id uuid,
  event_type text not null check (
    event_type in (
      'page_view',
      'scroll',
      'button_click',
      'signup_started',
      'signup',
      'checkout_started',
      'purchase',
      'studio_access',
      'music_generated',
      'mouse_movement'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tracking_events_partner_id on public.tracking_events(partner_id);
create index if not exists idx_tracking_events_session_id on public.tracking_events(session_id);
create index if not exists idx_tracking_events_event_type on public.tracking_events(event_type);
create index if not exists idx_tracking_events_created_at on public.tracking_events(created_at desc);

create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  purchase_id text not null,
  amount numeric(10,2) not null default 0,
  commission_amount numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (partner_id, purchase_id)
);

create index if not exists idx_partner_commissions_partner_id on public.partner_commissions(partner_id);
create index if not exists idx_partner_commissions_status on public.partner_commissions(status);

