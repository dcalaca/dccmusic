-- Acelera fotos de perfil dos compositores:
-- guarda o caminho no banco para não listar o Storage a cada visita.

alter table public.dccmusic_composers
  add column if not exists profile_photo_path text,
  add column if not exists profile_photo_url text,
  add column if not exists profile_photo_url_expires_at timestamptz;

comment on column public.dccmusic_composers.profile_photo_path is
  'Caminho no bucket studio-assets. Use o valor none quando confirmado que não há foto.';

comment on column public.dccmusic_composers.profile_photo_url is
  'URL assinada em cache (opcional) para servir a foto sem gerar de novo.';

comment on column public.dccmusic_composers.profile_photo_url_expires_at is
  'Validade da URL assinada em cache.';
