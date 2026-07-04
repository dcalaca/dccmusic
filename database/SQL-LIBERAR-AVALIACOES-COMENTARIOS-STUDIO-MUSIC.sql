-- Libera avaliacoes e comentarios para musicas publicas do DCC Studio IA.
--
-- Necessario porque as tabelas antigas aceitavam somente:
--   content_type = 'music' ou 'video'
--
-- Depois deste SQL, passam a aceitar tambem:
--   content_type = 'studio_music'
--
-- Como usar no Supabase:
-- 1. Abra o painel do Supabase.
-- 2. Clique em SQL Editor.
-- 3. Cole este arquivo inteiro.
-- 4. Clique em Run.

do $$
declare
  constraint_name text;
begin
  select con.conname
    into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'dccmusic_ratings'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%content_type%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.dccmusic_ratings drop constraint %I', constraint_name);
  end if;

  alter table public.dccmusic_ratings
    add constraint dccmusic_ratings_content_type_check
    check (content_type in ('music', 'video', 'studio_music'));
end $$;

do $$
declare
  constraint_name text;
begin
  select con.conname
    into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'dccmusic_comments'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%content_type%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.dccmusic_comments drop constraint %I', constraint_name);
  end if;

  alter table public.dccmusic_comments
    add constraint dccmusic_comments_content_type_check
    check (content_type in ('music', 'video', 'studio_music'));
end $$;

comment on column public.dccmusic_ratings.content_type is 'Tipo de conteúdo: music, video ou studio_music';
comment on column public.dccmusic_comments.content_type is 'Tipo de conteúdo: music, video ou studio_music';
