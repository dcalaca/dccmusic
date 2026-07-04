-- ============================================
-- SQL PARA ASSOCIAR TODAS AS OBRAS SEM COMPOSITOR AO DOUGLAS CALAÇA
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================
-- Este script associa TODAS as músicas e vídeos sem compositor ao Douglas Calaça
-- Execute este script se quiser associar tudo de uma vez
-- ============================================

-- Obter ID do compositor Douglas Calaça
DO $$
DECLARE
  v_composer_id UUID;
  v_musicas_associadas INTEGER := 0;
  v_videos_associados INTEGER := 0;
BEGIN
  -- Buscar ID do compositor
  SELECT id INTO v_composer_id
  FROM dccmusic_composers
  WHERE email = 'dcalaca@gmail.com' OR name ILIKE 'Douglas Calac%'
  LIMIT 1;

  IF v_composer_id IS NULL THEN
    RAISE EXCEPTION 'Compositor Douglas Calaça não encontrado!';
  END IF;

  RAISE NOTICE 'Compositor encontrado: ID = %', v_composer_id;

  -- Associar músicas SEM compositor ao Douglas Calaça
  INSERT INTO dccmusic_music_composers (music_id, composer_id)
  SELECT DISTINCT m.id, v_composer_id
  FROM dccmusic_musics m
  WHERE NOT EXISTS (
    SELECT 1 FROM dccmusic_music_composers mc
    WHERE mc.music_id = m.id
  )
  ON CONFLICT (music_id, composer_id) DO NOTHING;

  GET DIAGNOSTICS v_musicas_associadas = ROW_COUNT;
  
  -- Associar vídeos SEM compositor ao Douglas Calaça
  INSERT INTO dccmusic_video_composers (video_id, composer_id)
  SELECT DISTINCT v.id, v_composer_id
  FROM dccmusic_videos v
  WHERE NOT EXISTS (
    SELECT 1 FROM dccmusic_video_composers vc
    WHERE vc.video_id = v.id
  )
  ON CONFLICT (video_id, composer_id) DO NOTHING;

  GET DIAGNOSTICS v_videos_associados = ROW_COUNT;
  
  RAISE NOTICE 'Músicas associadas: %', v_musicas_associadas;
  RAISE NOTICE 'Vídeos associados: %', v_videos_associados;
END $$;

-- Verificar resultado final
SELECT 
  c.name as compositor,
  COUNT(DISTINCT vc.video_id) as total_videos,
  COUNT(DISTINCT mc.music_id) as total_musicas,
  COUNT(DISTINCT vc.video_id) + COUNT(DISTINCT mc.music_id) as total_obras
FROM dccmusic_composers c
LEFT JOIN dccmusic_video_composers vc ON c.id = vc.composer_id
LEFT JOIN dccmusic_music_composers mc ON c.id = mc.composer_id
WHERE c.email = 'dcalaca@gmail.com' OR c.name ILIKE 'Douglas Calac%'
GROUP BY c.id, c.name;
