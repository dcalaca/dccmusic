-- Corrige player da Música gerada #2 (Juvena)
-- Versão: 005d7a4b-9f0d-4f62-b6d5-aa38b7119c0e
-- URLs confirmadas agora na Suno (task 292bd425597aabf3bcaf9ae87b02b7d9)

-- Rode este UPDATE inteiro:

update public.studio_versions
set
  audio_url = 'https://tempfile.aiquickdraw.com/r/a698a0aeaed3452ca98ee44c1e8f372a.mp3',
  stream_audio_url = 'https://musicfile.removeai.ai/NmI2OGYxM2UtODU0NS00ODAwLWEyZjctMGRlZmQ5ODE5OWZi',
  duration = 249.68,
  updated_at = now()
where id = '005d7a4b-9f0d-4f62-b6d5-aa38b7119c0e'
returning id, version_name, audio_url, stream_audio_url, duration;
