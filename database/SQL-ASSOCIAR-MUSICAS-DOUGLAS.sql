-- ============================================
-- SQL PARA ASSOCIAR MÚSICAS SEM COMPOSITOR AO DOUGLAS CALAÇA
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================
-- Este script associa todas as músicas que NÃO têm compositor ao Douglas Calaça
-- ============================================

-- Obter ID do compositor Douglas Calaça
DO $$
DECLARE
  v_composer_id UUID;
  v_musicas_associadas INTEGER := 0;
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
  
  RAISE NOTICE 'Músicas associadas: %', v_musicas_associadas;
END $$;

-- Verificar resultado
SELECT 
  c.name as compositor,
  COUNT(DISTINCT mc.music_id) as total_musicas,
  STRING_AGG(DISTINCT m.title, ', ' ORDER BY m.title) as musicas
FROM dccmusic_composers c
LEFT JOIN dccmusic_music_composers mc ON c.id = mc.composer_id
LEFT JOIN dccmusic_musics m ON mc.music_id = m.id
WHERE c.email = 'dcalaca@gmail.com' OR c.name ILIKE 'Douglas Calac%'
GROUP BY c.id, c.name;

-- Listar todas as músicas do Douglas Calaça
SELECT 
  m.id,
  m.title as musica,
  m.slug,
  m.genre
FROM dccmusic_musics m
JOIN dccmusic_music_composers mc ON m.id = mc.music_id
JOIN dccmusic_composers c ON mc.composer_id = c.id
WHERE c.email = 'dcalaca@gmail.com' OR c.name ILIKE 'Douglas Calac%'
ORDER BY m.title;
