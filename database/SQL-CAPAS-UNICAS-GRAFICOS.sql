-- Report each stored image once per project, on its first creation date.
-- Repeated provider callbacks, selection changes and deleted covers do not
-- create additional generation events. Existing cover records remain intact.
create view public.studio_cover_generation_events with (security_invoker=true) as
select distinct on (
  project_id,
  provider,
  is_premium,
  coalesce(nullif(trim(image_path),''),nullif(trim(image_url),''),'record:'||id::text)
)
  id,project_id,composer_id,provider,is_premium,created_at
from public.studio_covers
order by
  project_id,
  provider,
  is_premium,
  coalesce(nullif(trim(image_path),''),nullif(trim(image_url),''),'record:'||id::text),
  created_at,id;
revoke all on public.studio_cover_generation_events from public,anon,authenticated;
grant select on public.studio_cover_generation_events to service_role;
