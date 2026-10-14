-- Real-schema regression checks. No files, images or production rows are changed.
begin;
set local role service_role;
do $$
declare
  v_project uuid; v_composer uuid;
  v_prefix text:='https://example.invalid/cover-qa-'||gen_random_uuid()::text;
  v_count integer;
begin
  select project_id,composer_id into v_project,v_composer from public.studio_covers where project_id is not null limit 1;
  if v_project is null then raise exception 'No project available for transactional cover fixture'; end if;
  insert into public.studio_covers(project_id,composer_id,provider,image_url,is_premium,is_current,created_at)
    values
      (v_project,v_composer,'sunoapi',v_prefix||'/original.png',false,false,'2026-10-10 23:50:00-03'),
      (v_project,v_composer,'sunoapi',v_prefix||'/original.png',false,false,'2026-10-12 12:00:00-03');
  insert into public.studio_covers(project_id,composer_id,provider,image_url,image_path,is_premium,is_current,created_at)
    values
      (v_project,v_composer,'openai',v_prefix||'/signed.png?signature=first',v_prefix||'/stored.png',true,false,'2026-10-11 12:00:00-03'),
      (v_project,v_composer,'openai',v_prefix||'/signed.png?signature=second',v_prefix||'/stored.png',true,false,'2026-10-12 12:00:00-03'),
      (v_project,v_composer,'openai',v_prefix||'/new.png',v_prefix||'/new.png',true,false,'2026-10-12 12:00:00-03');
  -- Deleting an image from a project does not erase its generation history.
  update public.studio_covers set deleted_at=now() where image_url=v_prefix||'/original.png';
  select count(*) into v_count from public.studio_cover_generation_events e
    where e.id in (select id from public.studio_covers where image_url like v_prefix||'%');
  if v_count<>3 then raise exception 'Expected 3 cover events, got %',v_count; end if;
  -- An old image repeated inside the requested window must not appear as new.
  select count(*) into v_count from public.studio_cover_generation_events e
    where e.id in (select id from public.studio_covers where image_url like v_prefix||'%')
      and e.created_at>='2026-10-12 00:00:00-03' and e.created_at<'2026-10-13 00:00:00-03';
  if v_count<>1 then raise exception 'Repeat crossed date boundary into chart: %',v_count; end if;
  select count(*) into v_count from public.studio_cover_generation_events e
    where e.id in (select id from public.studio_covers where image_url like v_prefix||'%')
      and (e.created_at at time zone 'America/Sao_Paulo')::date='2026-10-10';
  if v_count<>1 then raise exception 'First event uses the wrong local date'; end if;
  if has_table_privilege('anon','public.studio_cover_generation_events','select')
    or has_table_privilege('authenticated','public.studio_cover_generation_events','select') then raise exception 'Private chart data exposed'; end if;
end;
$$;
rollback;
select 'Cover deduplication, signed URLs, date filters and access checks passed; fixtures rolled back' as result;
