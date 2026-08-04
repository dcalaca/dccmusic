-- Transfere o projeto "Bandida" (Studio IA) para o Elton.
-- Projeto: 0e9cfe2b-faa8-4e65-b21f-e8f986a74779
-- Destino: eltongdn@gmail.com
--
-- Como rodar:
-- 1) Abra o Supabase do DCC Music
-- 2) Clique em SQL Editor
-- 3) New query
-- 4) Cole TODO este arquivo
-- 5) Clique em Run
--
-- Importante: NAO transfere studio_generations nem studio_credit_transactions,
-- para nao descontar credito do compositor que recebe.

do $$
declare
  v_project_id uuid := '0e9cfe2b-faa8-4e65-b21f-e8f986a74779';
  v_target_email text := 'eltongdn@gmail.com';
  v_target_composer_id uuid;
  v_old_composer_id uuid;
  v_project_title text;
begin
  select id
    into v_target_composer_id
  from public.dccmusic_composers
  where lower(email) = lower(v_target_email)
  limit 1;

  if v_target_composer_id is null then
    raise exception 'Compositor com e-mail % nao encontrado.', v_target_email;
  end if;

  select composer_id, title
    into v_old_composer_id, v_project_title
  from public.studio_projects
  where id = v_project_id;

  if v_old_composer_id is null then
    raise exception 'Projeto % nao encontrado.', v_project_id;
  end if;

  if v_old_composer_id = v_target_composer_id then
    raise notice 'O projeto "%" ja pertence ao compositor %.', v_project_title, v_target_email;
    return;
  end if;

  update public.studio_projects
     set composer_id = v_target_composer_id,
         favorite = false,
         updated_at = now()
   where id = v_project_id;

  update public.studio_lyrics
     set composer_id = v_target_composer_id,
         updated_at = now()
   where project_id = v_project_id;

  update public.studio_versions
     set composer_id = v_target_composer_id,
         updated_at = now()
   where project_id = v_project_id;

  update public.studio_covers
     set composer_id = v_target_composer_id
   where project_id = v_project_id;

  update public.studio_video_requests
     set composer_id = v_target_composer_id,
         updated_at = now()
   where project_id = v_project_id;

  raise notice 'Projeto "%" transferido para %.', v_project_title, v_target_email;
end $$;

-- Conferencia final: deve mostrar eltongdn@gmail.com como dono.
select
  p.id as project_id,
  p.title,
  p.status,
  p.slug,
  p.public_slug,
  c.name as novo_dono_nome,
  c.email as novo_dono_email,
  p.updated_at
from public.studio_projects p
join public.dccmusic_composers c on c.id = p.composer_id
where p.id = '0e9cfe2b-faa8-4e65-b21f-e8f986a74779';
