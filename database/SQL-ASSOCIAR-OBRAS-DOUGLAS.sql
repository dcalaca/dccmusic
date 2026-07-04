-- ============================================
-- SQL PARA ASSOCIAR OBRAS AO COMPOSITOR DOUGLAS CALAÇA
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================
-- ATENÇÃO: Este script associa TODAS as obras existentes ao Douglas Calaça
-- Use apenas se você quiser que ele apareça como compositor de tudo
-- ============================================

-- Obter ID do compositor Douglas Calaça
DO $$
DECLARE
  v_composer_id UUID;
BEGIN
  -- Buscar ID do compositor
  SELECT id INTO v_composer_id
  FROM dccmusic_composers
  WHERE email = 'dcalaca@gmail.com' OR name ILIKE 'Douglas Calac%'
  LIMIT 1;

  IF v_composer_id IS NULL THEN
    RAISE EXCEPTION 'Compositor Douglas Calaça não encontrado!';
  END IF;

  -- Associar TODOS os vídeos ao compositor (evitando duplicatas)
  INSERT INTO dccmusic_video_composers (video_id, composer_id)
  SELECT v.id, v_composer_id
  FROM dccmusic_videos v
  WHERE NOT EXISTS (
    SELECT 1 FROM dccmusic_video_composers vc
    WHERE vc.video_id = v.id AND vc.composer_id = v_composer_id
  );

  -- Associar TODAS as músicas ao compositor (evitando duplicatas)
  INSERT INTO dccmusic_music_composers (music_id, composer_id)
  SELECT m.id, v_composer_id
  FROM dccmusic_musics m
  WHERE NOT EXISTS (
    SELECT 1 FROM dccmusic_music_composers mc
    WHERE mc.music_id = m.id AND mc.composer_id = v_composer_id
  );

  RAISE NOTICE 'Obras associadas ao compositor ID: %', v_composer_id;
END $$;

-- Verificar resultado
SELECT 
  c.name as compositor,
  COUNT(DISTINCT vc.video_id) as total_videos,
  COUNT(DISTINCT mc.music_id) as total_musicas
FROM dccmusic_composers c
LEFT JOIN dccmusic_video_composers vc ON c.id = vc.composer_id
LEFT JOIN dccmusic_music_composers mc ON c.id = mc.composer_id
WHERE c.email = 'dcalaca@gmail.com' OR c.name ILIKE 'Douglas Calac%'
GROUP BY c.id, c.name;
