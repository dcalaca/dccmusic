-- Auditoria: projeto com só 1 versão
-- Projeto: 775904d2-7a53-457f-a963-7f4ce4d0104d
-- Rode no SQL Editor do Supabase.

-- 1) Projeto
select
  id,
  composer_id,
  title,
  status,
  created_at,
  updated_at
from public.studio_projects
where id = '775904d2-7a53-457f-a963-7f4ce4d0104d';

-- 2) Gerações desse projeto (qual provedor? Suno costuma 2; Mureka às vezes 1)
select
  id,
  status,
  provider,
  provider_task_id,
  callback_type,
  error_message,
  created_at,
  updated_at,
  request_payload->>'model' as request_model,
  coalesce(
    jsonb_array_length(response_payload->'data'->'data'),
    jsonb_array_length(response_payload->'data'->'response'->'sunoData'),
    jsonb_array_length(response_payload->'choices'),
    -1
  ) as tracks_in_payload
from public.studio_generations
where project_id = '775904d2-7a53-457f-a963-7f4ce4d0104d'
order by created_at asc;

-- 3) Versões salvas (o que o usuário vê)
select
  id,
  generation_id,
  version_name,
  is_current,
  audio_url is not null as has_audio_url,
  stream_audio_url is not null as has_stream,
  audio_path is not null as has_backup,
  duration,
  created_at,
  updated_at
from public.studio_versions
where project_id = '775904d2-7a53-457f-a963-7f4ce4d0104d'
order by created_at asc;

-- 4) Contagem por geração
select
  g.id as generation_id,
  g.provider,
  g.status,
  g.callback_type,
  count(v.id) as versions_count
from public.studio_generations g
left join public.studio_versions v on v.generation_id = g.id
where g.project_id = '775904d2-7a53-457f-a963-7f4ce4d0104d'
group by g.id, g.provider, g.status, g.callback_type
order by g.created_at asc;

-- 5) Compositor (pra responder o usuário)
select
  c.id,
  c.name,
  c.email
from public.dccmusic_composers c
join public.studio_projects p on p.composer_id = c.id
where p.id = '775904d2-7a53-457f-a963-7f4ce4d0104d';
