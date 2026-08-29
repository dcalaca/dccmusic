-- Backup permanente dos vídeos com letra do Studio IA.
alter table public.studio_video_requests
  add column if not exists video_path text,
  add column if not exists video_storage_provider text,
  add column if not exists video_backup_status text,
  add column if not exists video_backup_error text,
  add column if not exists video_backed_up_at timestamptz;

create index if not exists idx_studio_video_requests_backup_queue
  on public.studio_video_requests(video_backup_status, created_at)
  where status = 'completed' and video_path is null;
