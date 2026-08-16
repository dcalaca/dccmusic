-- Curtidas, respostas em comentários e notificações in-site (DCC Music)
-- Idempotente: pode rodar de novo sem quebrar.

alter table public.dccmusic_comments
  add column if not exists parent_id uuid references public.dccmusic_comments(id) on delete cascade;

create index if not exists idx_dccmusic_comments_parent_id
  on public.dccmusic_comments(parent_id);

create table if not exists public.dccmusic_comment_likes (
  comment_id uuid not null references public.dccmusic_comments(id) on delete cascade,
  user_id uuid not null references public.dccmusic_site_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists idx_dccmusic_comment_likes_user_id
  on public.dccmusic_comment_likes(user_id);

create table if not exists public.dccmusic_notifications (
  id uuid primary key default gen_random_uuid(),
  composer_id uuid not null references public.dccmusic_composers(id) on delete cascade,
  type text not null check (type in ('comment', 'reply', 'comment_like', 'new_music')),
  title text not null,
  body text,
  href text,
  actor_name text,
  event_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_dccmusic_notifications_event_key
  on public.dccmusic_notifications(event_key)
  where event_key is not null;

create index if not exists idx_dccmusic_notifications_composer_created
  on public.dccmusic_notifications(composer_id, created_at desc);

create index if not exists idx_dccmusic_notifications_unread
  on public.dccmusic_notifications(composer_id)
  where read_at is null;

alter table public.dccmusic_comment_likes enable row level security;
alter table public.dccmusic_notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dccmusic_comment_likes'
      and policyname = 'Block direct anon access to dccmusic_comment_likes'
  ) then
    create policy "Block direct anon access to dccmusic_comment_likes"
      on public.dccmusic_comment_likes
      for all
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'dccmusic_notifications'
      and policyname = 'Block direct anon access to dccmusic_notifications'
  ) then
    create policy "Block direct anon access to dccmusic_notifications"
      on public.dccmusic_notifications
      for all
      using (false)
      with check (false);
  end if;
end $$;

comment on column public.dccmusic_comments.parent_id is 'Comentário pai (resposta). Nulo = comentário principal.';
comment on table public.dccmusic_comment_likes is 'Curtidas em comentários (um like por usuário).';
comment on table public.dccmusic_notifications is 'Notificações in-site do compositor (comentário, resposta, curtida, música pronta).';
