create or replace function public.claim_studio_audio_backup_batch_v3(batch_limit integer default 3)
returns table (
  id uuid,
  composer_id uuid,
  audio_url text,
  stream_audio_url text,
  audio_path text,
  stream_audio_path text,
  audio_storage_provider text,
  stream_audio_storage_provider text,
  audio_backup_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select sv.id
    from public.studio_versions sv
    where (sv.audio_url is not null or sv.stream_audio_url is not null)
      and sv.audio_path is null
      and (
        coalesce(sv.audio_backup_status, 'pending') not in ('processing', 'backed_up')
        or (sv.audio_backup_status = 'processing' and sv.updated_at < now() - interval '15 minutes')
      )
    order by sv.created_at asc
    limit greatest(1, least(coalesce(batch_limit, 3), 3))
    for update skip locked
  ),
  marked as (
    update public.studio_versions sv
    set
      audio_path = sv.composer_id::text || '/audio/' || to_char(now(), 'YYYY-MM') || '/' || sv.id::text || '-audio.mp3',
      stream_audio_path = case
        when sv.stream_audio_url is not null and sv.stream_audio_url is distinct from sv.audio_url
          then sv.composer_id::text || '/audio/' || to_char(now(), 'YYYY-MM') || '/' || sv.id::text || '-stream.mp3'
        else sv.composer_id::text || '/audio/' || to_char(now(), 'YYYY-MM') || '/' || sv.id::text || '-audio.mp3'
      end,
      audio_backup_status = 'processing',
      audio_backup_error = null,
      updated_at = now()
    from picked
    where sv.id = picked.id
    returning
      sv.id,
      sv.composer_id,
      sv.audio_url,
      sv.stream_audio_url,
      sv.audio_path,
      sv.stream_audio_path,
      sv.audio_storage_provider,
      sv.stream_audio_storage_provider,
      sv.audio_backup_status,
      sv.created_at
  )
  select * from marked;
end;
$$;

grant execute on function public.claim_studio_audio_backup_batch_v3(integer) to service_role;
