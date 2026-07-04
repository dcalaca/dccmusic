-- ============================================
-- SQL PARA DIAGNOSTICAR PROBLEMA COM VÍDEO "BRINQUEI DE PECADO"
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script verifica todos os aspectos do vídeo que podem
-- estar causando ele não aparecer na lista pública
-- ============================================

-- 1. Verificar se o vídeo existe e seus dados básicos
SELECT 
  id,
  title,
  slug,
  genre,
  published_at,
  created_at,
  updated_at,
  featured,
  youtube_id,
  youtube_url,
  CASE 
    WHEN published_at IS NULL THEN '❌ published_at é NULL'
    WHEN published_at > NOW() THEN '⚠️ published_at é futuro'
    ELSE '✅ published_at OK'
  END as status_published_at,
  CASE 
    WHEN genre IS NULL THEN '❌ genre é NULL'
    WHEN genre = '' THEN '⚠️ genre está vazio'
    ELSE '✅ genre OK'
  END as status_genre
FROM dccmusic_videos
WHERE id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf'
   OR title ILIKE '%brinquei%pecado%';

-- 2. Verificar TODOS os vídeos Sertanejo para comparar
SELECT 
  id,
  title,
  genre,
  published_at,
  created_at,
  CASE 
    WHEN published_at IS NULL THEN 'NULL'
    WHEN published_at > NOW() THEN 'FUTURO'
    ELSE 'OK'
  END as status_published
FROM dccmusic_videos
WHERE genre = 'Sertanejo'
ORDER BY published_at DESC NULLS LAST;

-- 3. Contar vídeos por gênero (para verificar se a contagem está correta)
SELECT 
  genre,
  COUNT(*) as total,
  COUNT(CASE WHEN published_at IS NULL THEN 1 END) as sem_published_at,
  COUNT(CASE WHEN published_at > NOW() THEN 1 END) as published_futuro
FROM dccmusic_videos
GROUP BY genre
ORDER BY total DESC;

-- 4. Verificar se há vídeos com published_at NULL ou futuro
SELECT 
  COUNT(*) as total_videos,
  COUNT(CASE WHEN published_at IS NULL THEN 1 END) as sem_published_at,
  COUNT(CASE WHEN published_at > NOW() THEN 1 END) as published_futuro,
  COUNT(CASE WHEN genre IS NULL THEN 1 END) as sem_genero,
  COUNT(CASE WHEN genre = '' THEN 1 END) as genero_vazio
FROM dccmusic_videos;

-- 5. Verificar relações do vídeo com compositores
SELECT 
  vc.video_id,
  v.title as video_title,
  v.genre,
  v.published_at,
  c.id as composer_id,
  c.name as composer_name,
  c.slug as composer_slug
FROM dccmusic_video_composers vc
JOIN dccmusic_videos v ON v.id = vc.video_id
JOIN dccmusic_composers c ON c.id = vc.composer_id
WHERE vc.video_id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf'
   OR v.title ILIKE '%brinquei%pecado%';

-- 6. Testar query similar à função getVideos() (sem filtros de gênero)
SELECT 
  id,
  title,
  genre,
  published_at
FROM dccmusic_videos
ORDER BY published_at DESC NULLS LAST
LIMIT 20;

-- 7. Testar query com filtro de gênero Sertanejo
SELECT 
  id,
  title,
  genre,
  published_at
FROM dccmusic_videos
WHERE genre = 'Sertanejo'
ORDER BY published_at DESC NULLS LAST;

-- 8. Testar query com filtro de gênero usando IN (como na função)
SELECT 
  id,
  title,
  genre,
  published_at
FROM dccmusic_videos
WHERE genre IN ('Sertanejo', 'Funk', 'HipHop', 'Forró', 'Axé', 'Pop', 'MPB')
ORDER BY published_at DESC NULLS LAST
LIMIT 15;

-- 9. Verificar se há algum problema com RLS (verificar políticas)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'dccmusic_videos'
ORDER BY cmd;

-- 10. Verificar se o vídeo aparece em uma query sem RLS (usando service role)
-- NOTA: Esta query precisa ser executada com service role key
-- SELECT 
--   id,
--   title,
--   genre,
--   published_at
-- FROM dccmusic_videos
-- WHERE id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf';

-- ============================================
-- POSSÍVEIS PROBLEMAS E SOLUÇÕES:
-- ============================================
-- 1. Se published_at é NULL:
--    UPDATE dccmusic_videos 
--    SET published_at = created_at 
--    WHERE id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf' AND published_at IS NULL;
--
-- 2. Se published_at é futuro:
--    UPDATE dccmusic_videos 
--    SET published_at = created_at 
--    WHERE id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf' AND published_at > NOW();
--
-- 3. Se genre está NULL ou vazio:
--    UPDATE dccmusic_videos 
--    SET genre = 'Sertanejo' 
--    WHERE id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf' AND (genre IS NULL OR genre = '');
-- ============================================
