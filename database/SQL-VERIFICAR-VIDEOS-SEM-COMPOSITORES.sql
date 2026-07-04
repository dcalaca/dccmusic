-- ============================================
-- SQL PARA VERIFICAR VÍDEOS SEM COMPOSITORES OU COM PROBLEMAS
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script verifica se há vídeos sem relações de compositores
-- ou outros problemas que possam estar causando eles não aparecerem
-- ============================================

-- 1. Verificar TODOS os vídeos e quantos compositores cada um tem
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
GROUP BY v.id, v.title, v.genre, v.published_at, v.created_at
ORDER BY v.created_at DESC;

-- 2. Encontrar vídeos SEM compositores associados
SELECT 
  v.id,
  v.title,
  v.genre,
  v.published_at,
  v.created_at,
  '❌ SEM COMPOSITORES' as status
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
WHERE vc.video_id IS NULL
ORDER BY v.created_at DESC;

-- 3. Verificar vídeos com múltiplos compositores (suspeitos)
SELECT 
  v.id,
  v.title,
  v.genre,
  COUNT(vc.composer_id) as num_compositores,
  STRING_AGG(c.name, ', ') as compositores,
  CASE 
    WHEN COUNT(vc.composer_id) > 1 THEN '⚠️ MÚLTIPLOS COMPOSITORES'
    ELSE '✅ OK'
  END as status
FROM dccmusic_videos v
INNER JOIN dccmusic_video_composers vc ON v.id = vc.video_id
INNER JOIN dccmusic_composers c ON vc.composer_id = c.id
GROUP BY v.id, v.title, v.genre
HAVING COUNT(vc.composer_id) > 1
ORDER BY num_compositores DESC;

-- 4. Verificar o vídeo "Brinquei de Pecado" especificamente
SELECT 
  v.id,
  v.title,
  v.genre,
  v.published_at,
  COUNT(vc.composer_id) as num_compositores,
  STRING_AGG(c.name, ', ') as compositores,
  STRING_AGG(c.id::text, ', ') as composer_ids
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
LEFT JOIN dccmusic_composers c ON vc.composer_id = c.id
WHERE v.id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf'
   OR v.title ILIKE '%brinquei%pecado%'
GROUP BY v.id, v.title, v.genre, v.published_at;

-- 5. Verificar se há vídeos recentes (últimas 24 horas) sem compositores
SELECT 
  v.id,
  v.title,
  v.genre,
  v.created_at,
  COUNT(vc.composer_id) as num_compositores
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
WHERE v.created_at > NOW() - INTERVAL '24 hours'
GROUP BY v.id, v.title, v.genre, v.created_at
ORDER BY v.created_at DESC;

-- 6. Verificar se há vídeos com published_at NULL ou futuro
SELECT 
  v.id,
  v.title,
  v.genre,
  v.published_at,
  v.created_at,
  COUNT(vc.composer_id) as num_compositores,
  CASE 
    WHEN v.published_at IS NULL THEN '❌ published_at NULL'
    WHEN v.published_at > NOW() THEN '⚠️ published_at FUTURO'
    ELSE '✅ OK'
  END as status_published
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
WHERE v.published_at IS NULL OR v.published_at > NOW()
GROUP BY v.id, v.title, v.genre, v.published_at, v.created_at
ORDER BY v.created_at DESC;

-- 7. Comparar: vídeos que aparecem vs vídeos que não aparecem
-- (Vídeos com 1 compositor vs múltiplos compositores)
WITH video_composer_counts AS (
  SELECT 
    v.id,
    v.title,
    v.genre,
    COUNT(vc.composer_id) as num_compositores
  FROM dccmusic_videos v
  LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
  GROUP BY v.id, v.title, v.genre
)
SELECT 
  CASE 
    WHEN num_compositores = 0 THEN 'Sem Compositores'
    WHEN num_compositores = 1 THEN '1 Compositor'
    ELSE 'Múltiplos Compositores'
  END as tipo,
  COUNT(*) as total_videos,
  STRING_AGG(DISTINCT genre, ', ' ORDER BY genre) as generos
FROM video_composer_counts
GROUP BY 
  CASE 
    WHEN num_compositores = 0 THEN 'Sem Compositores'
    WHEN num_compositores = 1 THEN '1 Compositor'
    ELSE 'Múltiplos Compositores'
  END
ORDER BY total_videos DESC;

-- ============================================
-- POSSÍVEIS SOLUÇÕES:
-- ============================================
-- Se encontrar vídeos sem compositores:
-- 1. Verificar se foram criados corretamente
-- 2. Verificar se as relações foram criadas
--
-- Se encontrar vídeos com published_at NULL:
-- UPDATE dccmusic_videos 
-- SET published_at = created_at 
-- WHERE published_at IS NULL;
--
-- Se encontrar vídeos com published_at futuro:
-- UPDATE dccmusic_videos 
-- SET published_at = created_at 
-- WHERE published_at > NOW();
-- ============================================
