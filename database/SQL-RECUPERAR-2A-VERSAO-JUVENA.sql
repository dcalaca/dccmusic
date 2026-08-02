-- Recuperar a 2ª versão do projeto da Juvena
-- Projeto: 775904d2-7a53-457f-a963-7f4ce4d0104d
-- Geração: 928f60b7-1ec9-4af0-9795-f7ae47fa516b
-- Motivo: Suno mandou 2 faixas (tracks_in_payload=2), mas só 1 ficou em studio_versions.
--
-- PASSO 1: rode só e confira as 2 faixas do payload
-- PASSO 2: se estiver ok, rode o INSERT do PASSO 2

-- ========== PASSO 1 (só leitura) ==========
with gen as (
  select
    id,
    project_id,
    composer_id,
    response_payload
  from public.studio_generations
  where id = '928f60b7-1ec9-4af0-9795-f7ae47fa516b'
),
tracks as (
  select
    g.id as generation_id,
    g.project_id,
    g.composer_id,
    t.ordinality as track_index,
    t.elem as track
  from gen g
  cross join lateral jsonb_array_elements(
    coalesce(
      g.response_payload->'data'->'data',
      g.response_payload->'data'->'response'->'sunoData',
      '[]'::jsonb
    )
  ) with ordinality as t(elem, ordinality)
)
select
  track_index,
  track->>'id' as suno_id,
  track->>'title' as title,
  coalesce(track->>'audio_url', track->>'audioUrl') as audio_url,
  coalesce(track->>'stream_audio_url', track->>'streamAudioUrl') as stream_audio_url,
  track->>'duration' as duration,
  track->>'tags' as tags
from tracks
order by track_index;

-- Versões que já existem hoje:
select id, version_name, audio_url, stream_audio_url, is_current, created_at
from public.studio_versions
where project_id = '775904d2-7a53-457f-a963-7f4ce4d0104d'
order by created_at;

-- ========== PASSO 2 (escreve a 2ª versão que falta) ==========
-- Só rode depois de conferir o PASSO 1 (deve mostrar 2 faixas).
-- Insere a faixa #2 se ainda não existir URL igual.

/*
with gen as (
  select
    id,
    project_id,
    composer_id,
    response_payload
  from public.studio_generations
  where id = '928f60b7-1ec9-4af0-9795-f7ae47fa516b'
),
tracks as (
  select
    g.id as generation_id,
    g.project_id,
    g.composer_id,
    t.ordinality as track_index,
    t.elem as track
  from gen g
  cross join lateral jsonb_array_elements(
    coalesce(
      g.response_payload->'data'->'data',
      g.response_payload->'data'->'response'->'sunoData',
      '[]'::jsonb
    )
  ) with ordinality as t(elem, ordinality)
),
track2 as (
  select *
  from tracks
  where track_index = 2
)
insert into public.studio_versions (
  project_id,
  composer_id,
  generation_id,
  version_name,
  style,
  audio_url,
  stream_audio_url,
  duration,
  model,
  provider_payload,
  is_current,
  created_at,
  updated_at
)
select
  t.project_id,
  t.composer_id,
  t.generation_id,
  'Música gerada #2',
  t.track->>'tags',
  nullif(coalesce(t.track->>'audio_url', t.track->>'audioUrl'), ''),
  nullif(coalesce(
    t.track->>'stream_audio_url',
    t.track->>'streamAudioUrl',
    t.track->>'audio_url',
    t.track->>'audioUrl'
  ), ''),
  nullif(t.track->>'duration', '')::numeric,
  t.track->>'model_name',
  t.track,
  false,
  now(),
  now()
from track2 t
where not exists (
  select 1
  from public.studio_versions v
  where v.generation_id = t.generation_id
    and (
      v.audio_url = coalesce(t.track->>'audio_url', t.track->>'audioUrl')
      or v.stream_audio_url = coalesce(
        t.track->>'stream_audio_url',
        t.track->>'streamAudioUrl',
        t.track->>'audio_url',
        t.track->>'audioUrl'
      )
      or v.provider_payload->>'id' = t.track->>'id'
    )
)
returning id, version_name, audio_url, stream_audio_url;
*/
