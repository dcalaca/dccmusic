-- ============================================
-- SQL PARA ASSOCIAR VÍDEOS SEM COMPOSITOR AO DOUGLAS CALAÇA
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================
-- Este script associa todos os vídeos que NÃO têm compositor ao Douglas Calaça
-- ============================================

-- Obter ID do compositor Douglas Calaça
DO $$
DECLARE
  v_composer_id UUID;
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
  
  RAISE NOTICE 'Vídeos associados: %', v_videos_associados;
END $$;

-- Verificar resultado
SELECT 
  c.name as compositor,
  COUNT(DISTINCT vc.video_id) as total_videos,
  STRING_AGG(DISTINCT v.title, ', ' ORDER BY v.title) as videos
FROM dccmusic_composers c
LEFT JOIN dccmusic_video_composers vc ON c.id = vc.composer_id
LEFT JOIN dccmusic_videos v ON vc.video_id = v.id
WHERE c.email = 'dcalaca@gmail.com' OR c.name ILIKE 'Douglas Calac%'
GROUP BY c.id, c.name;

-- Listar todos os vídeos do Douglas Calaça
SELECT 
  v.id,
  v.title as video,
  v.slug,
  v.genre
FROM dccmusic_videos v
JOIN dccmusic_video_composers vc ON v.id = vc.video_id
JOIN dccmusic_composers c ON vc.composer_id = c.id
WHERE c.email = 'dcalaca@gmail.com' OR c.name ILIKE 'Douglas Calac%'
ORDER BY v.title;
