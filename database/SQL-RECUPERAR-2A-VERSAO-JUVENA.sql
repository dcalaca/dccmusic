  -- Recuperar a 2ª versão — Juvena
  -- Projeto: 775904d2-7a53-457f-a963-7f4ce4d0104d
  -- Geração: 928f60b7-1ec9-4af0-9795-f7ae47fa516b
  --
  -- Rode UM bloco de cada vez no SQL Editor.

  -- ============================================================
  -- BLOCO A — ver as 2 faixas no payload (só leitura)
  -- ============================================================
  select
    ordinality as track_index,
    elem->>'id' as suno_id,
    elem->>'title' as title,
    coalesce(elem->>'audio_url', elem->>'audioUrl') as audio_url,
    coalesce(
      elem->>'stream_audio_url',
      elem->>'streamAudioUrl',
      elem->>'source_stream_audio_url'
    ) as stream_audio_url,
    elem->>'duration' as duration,
    elem->>'tags' as tags
  from public.studio_generations g
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(g.response_payload->'data'->'data') = 'array'
        then g.response_payload->'data'->'data'
      when jsonb_typeof(g.response_payload->'data'->'response'->'sunoData') = 'array'
        then g.response_payload->'data'->'response'->'sunoData'
      when jsonb_typeof(g.response_payload->'sunoData') = 'array'
        then g.response_payload->'sunoData'
      when jsonb_typeof(g.response_payload->'data'->'sunoData') = 'array'
        then g.response_payload->'data'->'sunoData'
      else '[]'::jsonb
    end
  ) with ordinality as t(elem, ordinality)
  where g.id = '928f60b7-1ec9-4af0-9795-f7ae47fa516b'
  order by ordinality;

  -- Se o BLOCO A vier VAZIO, rode este para achar onde estão as faixas:
  /*
  select
    jsonb_typeof(response_payload->'data'->'data') as data_data_type,
    jsonb_typeof(response_payload->'data'->'response'->'sunoData') as suno_data_type,
    jsonb_typeof(response_payload->'sunoData') as root_suno_type,
    left(response_payload::text, 2000) as payload_preview
  from public.studio_generations
  where id = '928f60b7-1ec9-4af0-9795-f7ae47fa516b';
  */

  -- ============================================================
  -- BLOCO B — inserir a faixa #2 (só depois do A mostrar 2 linhas)
  -- ============================================================
  with tracks as (
    select
      g.id as generation_id,
      g.project_id,
      g.composer_id,
      ordinality as track_index,
      elem as track
    from public.studio_generations g
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(g.response_payload->'data'->'data') = 'array'
          then g.response_payload->'data'->'data'
        when jsonb_typeof(g.response_payload->'data'->'response'->'sunoData') = 'array'
          then g.response_payload->'data'->'response'->'sunoData'
        when jsonb_typeof(g.response_payload->'sunoData') = 'array'
          then g.response_payload->'sunoData'
        when jsonb_typeof(g.response_payload->'data'->'sunoData') = 'array'
          then g.response_payload->'data'->'sunoData'
        else '[]'::jsonb
      end
    ) with ordinality as t(elem, ordinality)
    where g.id = '928f60b7-1ec9-4af0-9795-f7ae47fa516b'
  ),
  track2 as (
    select * from tracks where track_index = 2
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
      t.track->>'source_stream_audio_url',
      t.track->>'audio_url',
      t.track->>'audioUrl'
    ), ''),
    nullif(t.track->>'duration', '')::numeric,
    coalesce(t.track->>'model_name', t.track->>'model'),
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
        v.provider_payload->>'id' = t.track->>'id'
        or v.audio_url = coalesce(t.track->>'audio_url', t.track->>'audioUrl')
        or v.stream_audio_url = coalesce(
          t.track->>'stream_audio_url',
          t.track->>'streamAudioUrl',
          t.track->>'audio_url',
          t.track->>'audioUrl'
        )
      )
  )
  returning id, version_name, audio_url, stream_audio_url, is_current;
