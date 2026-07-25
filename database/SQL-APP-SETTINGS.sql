-- Configurações editáveis pelo Admin DCC Music (/admin/configuracoes)
-- Execute este arquivo no Supabase: SQL Editor > New query > cole tudo > Run.

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.app_settings enable row level security;

-- Sem políticas públicas: só o backend (service role) acessa.
drop policy if exists "app_settings_no_public_access" on public.app_settings;

insert into public.app_settings (key, value, description)
values (
  'studio.long_lyric_prefer_mureka_chars',
  '1500',
  'A partir desta quantidade de caracteres na letra, o Studio IA prefere o Mureka em vez do Suno (máximo útil: 3000).'
)
on conflict (key) do nothing;
