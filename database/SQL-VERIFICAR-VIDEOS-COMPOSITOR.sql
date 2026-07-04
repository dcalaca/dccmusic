-- ============================================
-- SQL PARA VERIFICAR VÍDEOS DO COMPOSITOR
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================

-- Listar TODOS os vídeos e seus compositores (se houver)
SELECT 
  v.id as video_id,
  v.title as video,
  c.id as composer_id,
  c.name as compositor
FROM dccmusic_videos v
LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
LEFT JOIN dccmusic_composers c ON vc.composer_id = c.id
ORDER BY v.title;
