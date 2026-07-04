-- ============================================
-- SQL PARA VERIFICAR OBRAS DO COMPOSITOR DOUGLAS CALAÇA
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================

-- 1. Verificar ID do compositor Douglas Calaça
SELECT id, name, email FROM dccmusic_composers 
WHERE email = 'dcalaca@gmail.com' OR name ILIKE 'Douglas Calac%';

-- 2. Verificar quantos vídeos existem no total
SELECT COUNT(*) as total_videos FROM dccmusic_videos;

-- 3. Verificar quantos vídeos estão associados ao Douglas Calaça
SELECT COUNT(*) as videos_associados
FROM dccmusic_video_composers vc
JOIN dccmusic_composers c ON vc.composer_id = c.id
WHERE c.email = 'dcalaca@gmail.com' OR c.name ILIKE 'Douglas Calac%';

-- 4. Verificar quantas músicas existem no total
SELECT COUNT(*) as total_musicas FROM dccmusic_musics;

-- 5. Verificar quantas músicas estão associadas ao Douglas Calaça
SELECT COUNT(*) as musicas_associadas
FROM dccmusic_music_composers mc
JOIN dccmusic_composers c ON mc.composer_id = c.id
WHERE c.email = 'dcalaca@gmail.com' OR c.name ILIKE 'Douglas Calac%';

-- 6. Listar TODOS os vídeos e seus compositores (se houver)
SELECT 
  v.id as video_id,
  v.title as video,
  c.id as composer_id,
  c.name as compositor
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
LEFT JOIN dccmusic_composers c ON vc.composer_id = c.id
ORDER BY v.title
LIMIT 20;

-- 7. Listar TODAS as músicas e seus compositores (se houver)
SELECT 
  m.id as music_id,
  m.title as musica,
  c.id as composer_id,
  c.name as compositor
FROM dccmusic_musics m
LEFT JOIN dccmusic_music_composers mc ON m.id = mc.music_id
LEFT JOIN dccmusic_composers c ON mc.composer_id = c.id
ORDER BY m.title
LIMIT 20;
