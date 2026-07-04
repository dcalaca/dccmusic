-- ============================================
-- SQL PARA VERIFICAR GÊNERO DO VÍDEO
-- "Brinquei de Pecado"
-- ============================================

-- 1. Verificar o vídeo e seu gênero
SELECT 
  id,
  title,
  slug,
  genre,
  published_at,
  created_at
FROM dccmusic_videos
WHERE id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf'
   OR title ILIKE '%brinquei%pecado%';

-- 2. Verificar todos os gêneros únicos de vídeos
SELECT DISTINCT genre
FROM dccmusic_videos
WHERE genre IS NOT NULL
ORDER BY genre;

-- 3. Verificar quantos vídeos têm cada gênero
SELECT 
  genre,
  COUNT(*) as total
FROM dccmusic_videos
WHERE genre IS NOT NULL
GROUP BY genre
ORDER BY total DESC;

-- 4. Verificar vídeos sem gênero
SELECT 
  id,
  title,
  slug,
  genre,
  published_at
FROM dccmusic_videos
WHERE genre IS NULL
ORDER BY created_at DESC;

-- 5. Atualizar o gênero do vídeo "Brinquei de Pecado" se necessário
-- (Execute apenas se o gênero estiver NULL ou incorreto)
/*
UPDATE dccmusic_videos
SET genre = 'Sertanejo'  -- ou outro gênero apropriado
WHERE id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf'
  AND (genre IS NULL OR genre = '');
*/
