-- ============================================
-- SQL PARA VERIFICAR E CORRIGIR VÍDEO
-- "Brinquei de Pecado"
-- ============================================

-- 1. Verificar se o vídeo está na tabela de vídeos
SELECT 
  id,
  title,
  slug,
  genre,
  youtube_url,
  published_at,
  created_at
FROM dccmusic_videos
WHERE title ILIKE '%brinquei%pecado%'
   OR slug ILIKE '%brinquei%pecado%'
ORDER BY created_at DESC;

-- 2. Verificar relações de compositores para este vídeo
SELECT 
  vc.video_id,
  vc.composer_id,
  c.name as composer_name,
  c.id as composer_id_real,
  v.title as video_title
FROM dccmusic_video_composers vc
JOIN dccmusic_composers c ON vc.composer_id = c.id
JOIN dccmusic_videos v ON vc.video_id = v.id
WHERE v.title ILIKE '%brinquei%pecado%'
   OR v.slug ILIKE '%brinquei%pecado%';

-- 3. Verificar se há vídeos sem relações de compositores
SELECT 
  v.id,
  v.title,
  v.slug,
  COUNT(vc.composer_id) as num_composers
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
WHERE v.title ILIKE '%brinquei%pecado%'
   OR v.slug ILIKE '%brinquei%pecado%'
GROUP BY v.id, v.title, v.slug;

-- 4. Buscar o compositor "Douglas" ou similar
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

-- 5. Se o vídeo não tiver relação com compositor, criar manualmente
-- (Execute apenas se necessário - substitua os IDs pelos valores reais)
/*
DO $$
DECLARE
  video_record RECORD;
  composer_record RECORD;
BEGIN
  -- Buscar o vídeo
  SELECT * INTO video_record
  FROM dccmusic_videos
  WHERE title ILIKE '%brinquei%pecado%'
     OR slug ILIKE '%brinquei%pecado%'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Buscar o compositor Douglas
  SELECT * INTO composer_record
  FROM dccmusic_composers
  WHERE name ILIKE '%douglas%'
     OR name ILIKE '%doug%'
  ORDER BY name
  LIMIT 1;
  
  IF video_record IS NOT NULL AND composer_record IS NOT NULL THEN
    -- Verificar se a relação já existe
    IF NOT EXISTS (
      SELECT 1 FROM dccmusic_video_composers
      WHERE video_id = video_record.id
        AND composer_id = composer_record.id
    ) THEN
      -- Criar a relação
      INSERT INTO dccmusic_video_composers (video_id, composer_id)
      VALUES (video_record.id, composer_record.id);
      
      RAISE NOTICE 'Relação criada: Vídeo "%" associado ao compositor "%"', 
        video_record.title, composer_record.name;
    ELSE
      RAISE NOTICE 'Relação já existe';
    END IF;
  ELSE
    IF video_record IS NULL THEN
      RAISE NOTICE 'Vídeo não encontrado';
    END IF;
    IF composer_record IS NULL THEN
      RAISE NOTICE 'Compositor não encontrado';
    END IF;
  END IF;
END $$;
*/

-- 6. Verificar todos os vídeos sem relações
SELECT 
  v.id,
  v.title,
  v.slug,
  v.created_at,
  COUNT(vc.composer_id) as num_composers
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
GROUP BY v.id, v.title, v.slug, v.created_at
HAVING COUNT(vc.composer_id) = 0
ORDER BY v.created_at DESC
LIMIT 10;
