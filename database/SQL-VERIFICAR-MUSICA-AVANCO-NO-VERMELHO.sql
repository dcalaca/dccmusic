-- ============================================
-- Script para verificar música "Avanço no Vermelho"
-- ============================================

-- 1. Verificar se a música existe
SELECT 
  id,
  title,
  genre,
  created_at,
  published_at
FROM dccmusic_musics
WHERE title ILIKE '%avanço%vermelho%'
   OR title ILIKE '%avanc%vermelh%'
ORDER BY created_at DESC;

-- 2. Verificar todas as relações dessa música
SELECT 
  mc.id as relation_id,
  mc.music_id,
  mc.composer_id,
  m.title as music_title,
  c.name as composer_name,
  c.slug as composer_slug
FROM dccmusic_music_composers mc
JOIN dccmusic_musics m ON mc.music_id = m.id
JOIN dccmusic_composers c ON mc.composer_id = c.id
WHERE m.title ILIKE '%avanço%vermelho%'
   OR m.title ILIKE '%avanc%vermelh%';

-- 3. Verificar se Douglas Calaça tem relação com essa música
SELECT 
  mc.id as relation_id,
  mc.music_id,
  mc.composer_id,
  m.title as music_title,
  c.name as composer_name
FROM dccmusic_music_composers mc
JOIN dccmusic_musics m ON mc.music_id = m.id
JOIN dccmusic_composers c ON mc.composer_id = c.id
WHERE c.slug = 'douglas-calaca'
  AND (m.title ILIKE '%avanço%vermelho%' OR m.title ILIKE '%avanc%vermelh%');

-- 4. Listar TODAS as músicas de Douglas Calaça (para comparação)
SELECT 
  m.id,
  m.title,
  m.genre,
  m.created_at,
  c.name as composer_name
FROM dccmusic_music_composers mc
JOIN dccmusic_musics m ON mc.music_id = m.id
JOIN dccmusic_composers c ON mc.composer_id = c.id
WHERE c.slug = 'douglas-calaca'
ORDER BY m.created_at DESC;

-- 5. Se a relação não existir, criar (DESCOMENTE PARA EXECUTAR)
/*
-- Primeiro, encontrar o ID da música e do compositor
DO $$
DECLARE
  v_music_id UUID;
  v_composer_id UUID;
BEGIN
  -- Buscar ID da música
  SELECT id INTO v_music_id
  FROM dccmusic_musics
  WHERE title ILIKE '%avanço%vermelho%' OR title ILIKE '%avanc%vermelh%'
  LIMIT 1;
  
  -- Buscar ID do compositor
  SELECT id INTO v_composer_id
  FROM dccmusic_composers
  WHERE slug = 'douglas-calaca'
  LIMIT 1;
  
  -- Criar relação se ambos existirem
  IF v_music_id IS NOT NULL AND v_composer_id IS NOT NULL THEN
    INSERT INTO dccmusic_music_composers (music_id, composer_id)
    VALUES (v_music_id, v_composer_id)
    ON CONFLICT (music_id, composer_id) DO NOTHING;
    
    RAISE NOTICE 'Relação criada: música % com compositor %', v_music_id, v_composer_id;
  ELSE
    RAISE NOTICE 'Não foi possível criar relação. Música: %, Compositor: %', v_music_id, v_composer_id;
  END IF;
END $$;
*/
