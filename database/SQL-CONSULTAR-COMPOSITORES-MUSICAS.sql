-- Query para verificar quais músicas têm compositores e quais não têm
-- Mostra todas as músicas com a contagem de compositores

SELECT 
  m.id,
  m.title,
  m.slug,
  m.genre,
  COUNT(DISTINCT mc.composer_id) as total_compositores,
  CASE 
    WHEN COUNT(DISTINCT mc.composer_id) = 0 THEN 'SEM COMPOSITORES'
    ELSE 'COM COMPOSITORES'
  END as status
FROM dccmusic_musics m
LEFT JOIN dccmusic_music_composers mc ON m.id = mc.music_id
GROUP BY m.id, m.title, m.slug, m.genre
ORDER BY 
  CASE WHEN COUNT(DISTINCT mc.composer_id) = 0 THEN 0 ELSE 1 END,
  m.title;

-- Query alternativa: Mostrar apenas as músicas SEM compositores
SELECT 
  m.id,
  m.title,
  m.slug,
  m.genre,
  m.created_at
FROM dccmusic_musics m
LEFT JOIN dccmusic_music_composers mc ON m.id = mc.music_id
WHERE mc.composer_id IS NULL
ORDER BY m.title;

-- Query para ver detalhes: Músicas com seus compositores
SELECT 
  m.id as music_id,
  m.title as musica,
  m.genre,
  c.id as composer_id,
  c.name as compositor,
  c.slug as composer_slug
FROM dccmusic_musics m
LEFT JOIN dccmusic_music_composers mc ON m.id = mc.music_id
LEFT JOIN dccmusic_composers c ON mc.composer_id = c.id
ORDER BY m.title, c.name;

-- Query resumida: Total de músicas com e sem compositores
SELECT 
  COUNT(DISTINCT m.id) as total_musicas,
  COUNT(DISTINCT CASE WHEN mc.composer_id IS NOT NULL THEN m.id END) as musicas_com_compositores,
  COUNT(DISTINCT CASE WHEN mc.composer_id IS NULL THEN m.id END) as musicas_sem_compositores
FROM dccmusic_musics m
LEFT JOIN dccmusic_music_composers mc ON m.id = mc.music_id;
