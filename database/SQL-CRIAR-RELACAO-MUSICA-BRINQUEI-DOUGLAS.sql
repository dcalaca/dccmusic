-- ============================================
-- Script para criar relação entre música "Brinquei de Pecado" e Douglas Calaça
-- ============================================

-- 1. Verificar se a música existe
SELECT 
  id,
  title,
  genre,
  created_at
FROM dccmusic_musics
WHERE id = 'd73e5a7b-4db3-4c6c-bf79-6c0efcf8dfc5'
   OR title ILIKE '%brinquei%pecado%';

-- 2. Verificar se Douglas Calaça existe
SELECT 
  id,
  name,
  slug
FROM dccmusic_composers
WHERE id = '5b46799f-a037-49d4-8895-87478a40c046'
   OR slug = 'douglas-calaca';

-- 3. Verificar se a relação já existe
SELECT 
  mc.id as relation_id,
  mc.music_id,
  mc.composer_id,
  m.title as music_title,
  c.name as composer_name
FROM dccmusic_music_composers mc
JOIN dccmusic_musics m ON mc.music_id = m.id
JOIN dccmusic_composers c ON mc.composer_id = c.id
WHERE mc.music_id = 'd73e5a7b-4db3-4c6c-bf79-6c0efcf8dfc5'
  AND mc.composer_id = '5b46799f-a037-49d4-8895-87478a40c046';

-- 4. Verificar TODAS as relações da música "Brinquei de Pecado"
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
WHERE mc.music_id = 'd73e5a7b-4db3-4c6c-bf79-6c0efcf8dfc5';

-- 5. CRIAR a relação se não existir (DESCOMENTE PARA EXECUTAR)
/*
INSERT INTO dccmusic_music_composers (music_id, composer_id)
VALUES ('d73e5a7b-4db3-4c6c-bf79-6c0efcf8dfc5', '5b46799f-a037-49d4-8895-87478a40c046')
ON CONFLICT (music_id, composer_id) DO NOTHING;
*/

-- 6. Verificar novamente após criar a relação
SELECT 
  mc.id as relation_id,
  mc.music_id,
  mc.composer_id,
  m.title as music_title,
  c.name as composer_name
FROM dccmusic_music_composers mc
JOIN dccmusic_musics m ON mc.music_id = m.id
JOIN dccmusic_composers c ON mc.composer_id = c.id
WHERE mc.music_id = 'd73e5a7b-4db3-4c6c-bf79-6c0efcf8dfc5'
  AND mc.composer_id = '5b46799f-a037-49d4-8895-87478a40c046';
