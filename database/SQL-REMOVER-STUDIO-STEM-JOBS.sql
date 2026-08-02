-- Opcional: remove tabelas do Mixer (separação de stems) do Supabase.
-- Rode no SQL Editor se quiser limpar o banco também.
-- O código do Mixer já foi removido do site; sem isso ninguém consegue usar.

drop table if exists public.studio_stem_exports cascade;
drop table if exists public.studio_stem_jobs cascade;
