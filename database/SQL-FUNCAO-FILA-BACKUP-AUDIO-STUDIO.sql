-- Fila de backup de áudio do Studio IA
-- v4: NÃO reserva audio_path antes do upload (path fantasma impedia retry).
-- Também reprocessa failed/pending e processing travado.

create or replace function public.claim_studio_audio_backup_batch_v3(batch_limit integer default 5)
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
      and coalesce(sv.audio_backup_status, 'pending') <> 'backed_up'
      and (
        -- Ainda não confirmou backup real no R2
        coalesce(sv.audio_storage_provider, '') is distinct from 'r2'
        or sv.audio_path is null
        or coalesce(sv.audio_backup_status, 'pending') in ('pending', 'failed')
        or (
          sv.audio_backup_status = 'processing'
          and sv.updated_at < now() - interval '15 minutes'
        )
      )
      and (
        coalesce(sv.audio_backup_status, 'pending') not in ('processing')
        or (sv.audio_backup_status = 'processing' and sv.updated_at < now() - interval '15 minutes')
      )
    order by
      case coalesce(sv.audio_backup_status, 'pending')
        when 'pending' then 0
        when 'failed' then 1
        else 2
      end,
      sv.created_at asc
    limit greatest(1, least(coalesce(batch_limit, 5), 10))
    for update skip locked
  ),
  marked as (
    update public.studio_versions sv
    set
      -- Não grava path aqui. Path só depois do upload confirmar.
      audio_path = null,
      stream_audio_path = null,
      audio_storage_provider = null,
      stream_audio_storage_provider = null,
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
