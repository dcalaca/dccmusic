-- ============================================
-- SQL PARA VERIFICAR E CORRIGIR RELAÇÃO
-- do vídeo "Brinquei de Pecado" com Douglas
-- ============================================

-- 1. Buscar o vídeo "Brinquei de Pecado"
SELECT 
  id,
  title,
  slug,
  genre,
  youtube_url,
  created_at
FROM dccmusic_videos
WHERE title ILIKE '%brinquei%pecado%'
   OR slug ILIKE '%brinquei%pecado%'
ORDER BY created_at DESC;

-- 2. Buscar o compositor Douglas Calaça
SELECT 
  id,
  name,
  slug,
  email
FROM dccmusic_composers
WHERE id = '5b46799f-a037-49d4-8895-87478a40c046'
   OR name ILIKE '%douglas%calaça%';

-- 3. Verificar TODAS as relações deste vídeo
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

-- 4. Verificar se há relação específica com Douglas
SELECT 
  vc.*,
  v.title as video_title,
  c.name as composer_name
FROM dccmusic_video_composers vc
JOIN dccmusic_videos v ON vc.video_id = v.id
JOIN dccmusic_composers c ON vc.composer_id = c.id
WHERE v.title ILIKE '%brinquei%pecado%'
  AND c.id = '5b46799f-a037-49d4-8895-87478a40c046';

-- 5. Se não houver relação, criar manualmente
-- (Execute apenas se necessário - substitua os IDs pelos valores reais da query acima)
DO $$
DECLARE
  video_id_var UUID;
  composer_id_var UUID := '5b46799f-a037-49d4-8895-87478a40c046';
BEGIN
  -- Buscar o ID do vídeo "Brinquei de Pecado"
  SELECT id INTO video_id_var
  FROM dccmusic_videos
  WHERE title ILIKE '%brinquei%pecado%'
     OR slug ILIKE '%brinquei%pecado%'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF video_id_var IS NULL THEN
    RAISE NOTICE 'Vídeo "Brinquei de Pecado" não encontrado';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Vídeo encontrado: %', video_id_var;
  
  -- Verificar se a relação já existe
  IF EXISTS (
    SELECT 1 FROM dccmusic_video_composers
    WHERE video_id = video_id_var
      AND composer_id = composer_id_var
  ) THEN
    RAISE NOTICE 'Relação já existe';
  ELSE
    -- Criar a relação
    INSERT INTO dccmusic_video_composers (video_id, composer_id)
    VALUES (video_id_var, composer_id_var);
    
    RAISE NOTICE 'Relação criada com sucesso!';
  END IF;
END $$;

-- 6. Verificar novamente após correção
SELECT 
  vc.video_id,
  vc.composer_id,
  c.name as composer_name,
  v.title as video_title
FROM dccmusic_video_composers vc
JOIN dccmusic_composers c ON vc.composer_id = c.id
JOIN dccmusic_videos v ON vc.video_id = v.id
WHERE v.title ILIKE '%brinquei%pecado%'
   OR v.slug ILIKE '%brinquei%pecado%';
