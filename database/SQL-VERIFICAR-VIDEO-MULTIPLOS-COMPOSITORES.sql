-- ============================================
-- SQL PARA VERIFICAR DETALHES DO VÍDEO COM MÚLTIPLOS COMPOSITORES
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script verifica especificamente o vídeo com múltiplos compositores
-- que não está aparecendo na página pública
-- ============================================

-- 1. Encontrar o vídeo com múltiplos compositores
SELECT 
  v.id,
  v.title,
  v.slug,
  v.genre,
  v.published_at,
  v.created_at,
  v.updated_at,
  v.featured,
  v.youtube_id,
  v.youtube_url,
  COUNT(vc.composer_id) as num_compositores,
  STRING_AGG(c.name, ', ' ORDER BY c.name) as compositores,
  STRING_AGG(c.id::text, ', ') as composer_ids,
  CASE 
    WHEN v.published_at IS NULL THEN '❌ published_at é NULL'
    WHEN v.published_at > NOW() THEN '⚠️ published_at é futuro'
    WHEN v.published_at < NOW() THEN '✅ published_at OK'
    ELSE '❓ published_at desconhecido'
  END as status_published_at,
  CASE 
    WHEN v.genre IS NULL THEN '❌ genre é NULL'
    WHEN v.genre = '' THEN '⚠️ genre está vazio'
    ELSE '✅ genre OK'
  END as status_genre
FROM dccmusic_videos v
INNER JOIN dccmusic_video_composers vc ON v.id = vc.video_id
INNER JOIN dccmusic_composers c ON vc.composer_id = c.id
GROUP BY v.id, v.title, v.slug, v.genre, v.published_at, v.created_at, v.updated_at, v.featured, v.youtube_id, v.youtube_url
HAVING COUNT(vc.composer_id) > 1
ORDER BY v.created_at DESC;

-- 2. Comparar com vídeos Sertanejo que aparecem (1 compositor)
SELECT 
  v.id,
  v.title,
  v.genre,
  v.published_at,
  v.created_at,
  COUNT(vc.composer_id) as num_compositores,
  STRING_AGG(c.name, ', ') as compositores
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
LEFT JOIN dccmusic_composers c ON vc.composer_id = c.id
WHERE v.genre = 'Sertanejo'
GROUP BY v.id, v.title, v.genre, v.published_at, v.created_at
ORDER BY v.created_at DESC;

-- 3. Verificar se há diferença nas datas de publicação
WITH video_composer_counts AS (
  SELECT 
    v.id,
    v.published_at,
    COUNT(vc.composer_id) as num_compositores
  FROM dccmusic_videos v
  LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
  GROUP BY v.id, v.published_at
)
SELECT 
  CASE 
    WHEN num_compositores = 0 THEN 'Sem Compositores'
    WHEN num_compositores = 1 THEN '1 Compositor'
    ELSE 'Múltiplos Compositores'
  END as tipo,
  COUNT(*) as total,
  MIN(published_at) as published_at_min,
  MAX(published_at) as published_at_max,
  COUNT(CASE WHEN published_at IS NULL THEN 1 END) as sem_published_at,
  COUNT(CASE WHEN published_at > NOW() THEN 1 END) as published_futuro
FROM video_composer_counts
GROUP BY 
  CASE 
    WHEN num_compositores = 0 THEN 'Sem Compositores'
    WHEN num_compositores = 1 THEN '1 Compositor'
    ELSE 'Múltiplos Compositores'
  END
ORDER BY total DESC;

-- 4. Testar query similar à função getVideos() com filtro de gênero Sertanejo
SELECT 
  id,
  title,
  genre,
  published_at,
  created_at
FROM dccmusic_videos
WHERE genre = 'Sertanejo'
ORDER BY published_at DESC NULLS LAST;

-- 5. Testar query com filtro IN (como na função quando todos os gêneros estão selecionados)
SELECT 
  id,
  title,
  genre,
  published_at,
  created_at
FROM dccmusic_videos
WHERE genre IN ('Sertanejo', 'Funk', 'HipHop', 'Forró', 'Axé', 'Pop', 'MPB')
ORDER BY published_at DESC NULLS LAST
LIMIT 15;

-- 6. Verificar se há algum problema com RLS específico para vídeos com múltiplos compositores
-- (Verificar se há políticas que filtram por número de compositores)
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
WHERE tablename IN ('dccmusic_videos', 'dccmusic_video_composers')
ORDER BY tablename, cmd;

-- 7. Verificar relações específicas do vídeo "Brinquei de Pecado"
SELECT 
  vc.video_id,
  v.title as video_title,
  v.genre,
  vc.composer_id,
  c.name as composer_name,
  c.slug as composer_slug
FROM dccmusic_video_composers vc
JOIN dccmusic_videos v ON v.id = vc.video_id
JOIN dccmusic_composers c ON c.id = vc.composer_id
WHERE v.id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf'
   OR v.title ILIKE '%brinquei%pecado%'
ORDER BY c.name;

-- ============================================
-- POSSÍVEIS PROBLEMAS E SOLUÇÕES:
-- ============================================
-- Se o vídeo tem published_at NULL:
-- UPDATE dccmusic_videos 
-- SET published_at = created_at 
-- WHERE id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf' AND published_at IS NULL;
--
-- Se o vídeo tem published_at futuro:
-- UPDATE dccmusic_videos 
-- SET published_at = created_at 
-- WHERE id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf' AND published_at > NOW();
--
-- Se o vídeo não aparece na query 4 ou 5, pode ser problema de cache ou RLS
-- ============================================
