-- Transfere uma música/projeto do Studio IA para outro compositor como brinde.
-- Importante: este script NAO transfere studio_generations nem studio_credit_transactions,
-- para nao descontar credito do compositor que vai receber o brinde.

do $$
declare
  v_project_id uuid := 'f33ba1a6-425d-48ff-a62e-1157a709568f';
  v_target_email text := 'walllopezlopez@gmail.com';
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

  raise notice 'Projeto "%" transferido como brinde para %.', v_project_title, v_target_email;
end $$;

-- Conferencia final: deve mostrar o e-mail walllopezlopez@gmail.com como dono do projeto.
select
  p.id as project_id,
  p.title,
  p.status,
  p.slug,
  p.public_slug,
  c.email as novo_dono,
  p.updated_at
from public.studio_projects p
join public.dccmusic_composers c on c.id = p.composer_id
where p.id = 'f33ba1a6-425d-48ff-a62e-1157a709568f';
