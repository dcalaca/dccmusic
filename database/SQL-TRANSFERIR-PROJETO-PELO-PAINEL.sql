-- Transferência atômica de um projeto do Studio IA.
-- Chamada exclusivamente pelo backend com service_role após validar a conta administradora.

create or replace function public.transfer_studio_project(
  p_project_id uuid,
  p_from_composer_id uuid,
  p_to_composer_id uuid
)
returns table (project_id uuid, title text)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_project public.studio_projects%rowtype;
begin
  if p_from_composer_id = p_to_composer_id then
    raise exception 'O projeto já pertence a este compositor.';
  end if;

  select *
    into v_project
  from public.studio_projects
  where id = p_project_id
    and composer_id = p_from_composer_id
  for update;

  if not found then
    raise exception 'Projeto não encontrado na conta de origem.';
  end if;

  if v_project.status = 'generating' or exists (
    select 1
    from public.studio_generations
    where project_id = p_project_id
      and composer_id = p_from_composer_id
      and status in ('pending', 'processing', 'first_ready')
  ) then
    raise exception 'Aguarde a geração terminar antes de transferir este projeto.';
  end if;

  if not exists (select 1 from public.dccmusic_composers where id = p_to_composer_id) then
    raise exception 'Compositor de destino não encontrado.';
  end if;

  update public.studio_projects
     set composer_id = p_to_composer_id,
         favorite = false,
         updated_at = now()
   where id = p_project_id;

  update public.studio_lyrics
     set composer_id = p_to_composer_id,
         updated_at = now()
   where project_id = p_project_id;

  update public.studio_versions
     set composer_id = p_to_composer_id,
         updated_at = now()
   where project_id = p_project_id;

  update public.studio_covers
     set composer_id = p_to_composer_id
   where project_id = p_project_id;

  update public.studio_video_requests
     set composer_id = p_to_composer_id,
         updated_at = now()
   where project_id = p_project_id;

  update public.music_transcriptions
     set composer_id = p_to_composer_id,
         updated_at = now()
   where studio_project_id = p_project_id;

  update public.studio_inspiration_requests
     set composer_id = p_to_composer_id,
         updated_at = now()
   where target_project_id = p_project_id;

  return query select v_project.id, v_project.title;
end;
$$;

revoke all on function public.transfer_studio_project(uuid, uuid, uuid) from public;
revoke execute on function public.transfer_studio_project(uuid, uuid, uuid) from anon, authenticated;
grant execute on function public.transfer_studio_project(uuid, uuid, uuid) to service_role;
