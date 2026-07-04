-- ============================================
-- SQL PARA VERIFICAR E CORRIGIR TODAS AS RELAÇÕES
-- de vídeos com o compositor Douglas Calaça
-- ============================================

-- 1. Buscar o compositor Douglas
SELECT 
  id,
  name,
  slug,
  email,
  is_premium,
  has_active_subscription
FROM dccmusic_composers
WHERE name ILIKE '%douglas%'
   OR name ILIKE '%doug%'
ORDER BY name;

-- 2. Verificar TODOS os vídeos na tabela
SELECT 
  id,
  title,
  slug,
  genre,
  youtube_url,
  published_at,
  created_at
FROM dccmusic_videos
ORDER BY created_at DESC
LIMIT 20;

-- 3. Verificar TODAS as relações vídeo-compositor
SELECT 
  vc.video_id,
  vc.composer_id,
  c.name as composer_name,
  v.title as video_title,
  v.genre as video_genre
FROM dccmusic_video_composers vc
JOIN dccmusic_composers c ON vc.composer_id = c.id
JOIN dccmusic_videos v ON vc.video_id = v.id
ORDER BY v.created_at DESC;

-- 4. Verificar vídeos SEM relações
SELECT 
  v.id,
  v.title,
  v.slug,
  v.genre,
  v.created_at,
  COUNT(vc.composer_id) as num_composers
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
GROUP BY v.id, v.title, v.slug, v.genre, v.created_at
HAVING COUNT(vc.composer_id) = 0
ORDER BY v.created_at DESC;

-- 5. Associar TODOS os vídeos ao compositor Douglas
-- (Execute apenas se necessário - substitua o ID do compositor pelo valor real)
/*
DO $$
DECLARE
  composer_id_var UUID;
  video_record RECORD;
  relation_count INTEGER;
BEGIN
  -- Buscar o ID do compositor Douglas
  SELECT id INTO composer_id_var
  FROM dccmusic_composers
  WHERE name ILIKE '%douglas%'
     OR name ILIKE '%doug%'
  ORDER BY name
  LIMIT 1;
  
  IF composer_id_var IS NULL THEN
    RAISE NOTICE 'Compositor Douglas não encontrado';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Compositor encontrado: %', composer_id_var;
  
  -- Para cada vídeo sem relação, criar relação com Douglas
  FOR video_record IN 
    SELECT v.id, v.title
    FROM dccmusic_videos v
    LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
    WHERE vc.video_id IS NULL
  LOOP
    -- Verificar se a relação já existe
    SELECT COUNT(*) INTO relation_count
    FROM dccmusic_video_composers
    WHERE video_id = video_record.id
      AND composer_id = composer_id_var;
    
    IF relation_count = 0 THEN
      -- Criar a relação
      INSERT INTO dccmusic_video_composers (video_id, composer_id)
      VALUES (video_record.id, composer_id_var);
      
      RAISE NOTICE 'Relação criada: Vídeo "%" associado ao compositor', video_record.title;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Processo concluído';
END $$;
*/

-- 6. Contar vídeos por compositor
SELECT 
  c.name as composer_name,
  COUNT(vc.video_id) as total_videos
FROM dccmusic_composers c
LEFT JOIN dccmusic_video_composers vc ON c.id = vc.composer_id
GROUP BY c.id, c.name
ORDER BY total_videos DESC;

-- 7. Verificar vídeos duplicados (mesmo vídeo associado a múltiplos compositores)
SELECT 
  vc.video_id,
  v.title as video_title,
  COUNT(vc.composer_id) as num_composers,
  STRING_AGG(c.name, ', ') as composer_names
FROM dccmusic_video_composers vc
JOIN dccmusic_videos v ON vc.video_id = v.id
JOIN dccmusic_composers c ON vc.composer_id = c.id
GROUP BY vc.video_id, v.title
HAVING COUNT(vc.composer_id) > 1
ORDER BY num_composers DESC;
