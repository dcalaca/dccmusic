-- Query para verificar quais vídeos têm compositores e quais não têm
-- Mostra todos os vídeos com a contagem de compositores

SELECT 
  v.id,
  v.title,
  v.slug,
  v.genre,
  COUNT(DISTINCT vc.composer_id) as total_compositores,
  CASE 
    WHEN COUNT(DISTINCT vc.composer_id) = 0 THEN 'SEM COMPOSITORES'
    ELSE 'COM COMPOSITORES'
  END as status
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
GROUP BY v.id, v.title, v.slug, v.genre
ORDER BY 
  CASE WHEN COUNT(DISTINCT vc.composer_id) = 0 THEN 0 ELSE 1 END,
  v.title;

-- Query alternativa: Mostrar apenas os vídeos SEM compositores
SELECT 
  v.id,
  v.title,
  v.slug,
  v.genre,
  v.created_at
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
WHERE vc.composer_id IS NULL
ORDER BY v.title;

-- Query para ver detalhes: Vídeos com seus compositores
SELECT 
  v.id as video_id,
  v.title as video,
  v.genre,
  c.id as composer_id,
  c.name as compositor,
  c.slug as composer_slug
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
LEFT JOIN dccmusic_composers c ON vc.composer_id = c.id
ORDER BY v.title, c.name;

-- Query resumida: Total de vídeos com e sem compositores
SELECT 
  COUNT(DISTINCT v.id) as total_videos,
  COUNT(DISTINCT CASE WHEN vc.composer_id IS NOT NULL THEN v.id END) as videos_com_compositores,
  COUNT(DISTINCT CASE WHEN vc.composer_id IS NULL THEN v.id END) as videos_sem_compositores
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id;
