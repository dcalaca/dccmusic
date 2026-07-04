-- ============================================
-- SQL PARA VERIFICAR E CORRIGIR MÚSICA
-- "Brinquei de Pecado"
-- ============================================

-- 1. Verificar se a música está na tabela de músicas
SELECT 
  id,
  title,
  slug,
  genre,
  spotify_url,
  published_at,
  created_at
FROM dccmusic_musics
WHERE title ILIKE '%brinquei%pecado%'
   OR slug ILIKE '%brinquei%pecado%'
ORDER BY created_at DESC;

-- 2. Verificar se está na tabela de vídeos (erro)
SELECT 
  id,
  title,
  slug,
  genre,
  youtube_url,
  published_at,
  created_at
FROM dccmusic_videos
WHERE title ILIKE '%brinquei%pecado%'
   OR slug ILIKE '%brinquei%pecado%'
ORDER BY created_at DESC;

-- 3. Verificar relações de compositores na tabela de músicas
SELECT 
  mc.music_id,
  mc.composer_id,
  c.name as composer_name,
  m.title as music_title
FROM dccmusic_music_composers mc
JOIN dccmusic_composers c ON mc.composer_id = c.id
JOIN dccmusic_musics m ON mc.music_id = m.id
WHERE m.title ILIKE '%brinquei%pecado%'
   OR m.slug ILIKE '%brinquei%pecado%';

-- 4. Se a música estiver na tabela de vídeos, mover para músicas
-- (Execute apenas se encontrar na tabela de vídeos)
/*
-- Primeiro, obter o ID do vídeo incorreto
DO $$
DECLARE
  video_record RECORD;
  new_music_id UUID;
BEGIN
  -- Buscar o vídeo incorreto
  SELECT * INTO video_record
  FROM dccmusic_videos
  WHERE title ILIKE '%brinquei%pecado%'
     OR slug ILIKE '%brinquei%pecado%'
  LIMIT 1;
  
  IF video_record IS NOT NULL THEN
    -- Criar música na tabela correta
    INSERT INTO dccmusic_musics (
      title,
      slug,
      genre,
      spotify_url,
      spotify_embed,
      tags,
      description,
      featured,
      published_at,
      created_at,
      updated_at
    )
    VALUES (
      video_record.title,
      video_record.slug,
      video_record.genre,
      NULL, -- spotify_url (não existe em vídeos)
      NULL, -- spotify_embed
      video_record.tags,
      video_record.description,
      video_record.featured,
      video_record.published_at,
      video_record.created_at,
      video_record.updated_at
    )
    RETURNING id INTO new_music_id;
    
    -- Migrar relações de compositores
    INSERT INTO dccmusic_music_composers (music_id, composer_id)
    SELECT new_music_id, composer_id
    FROM dccmusic_video_composers
    WHERE video_id = video_record.id;
    
    -- Deletar vídeo incorreto
    DELETE FROM dccmusic_videos WHERE id = video_record.id;
    
    RAISE NOTICE 'Música movida com sucesso. Novo ID: %', new_music_id;
  ELSE
    RAISE NOTICE 'Nenhum vídeo encontrado com esse título';
  END IF;
END $$;
*/

-- 5. Verificar estrutura da tabela dccmusic_musics
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'dccmusic_musics'
ORDER BY ordinal_position;

-- 6. Verificar constraints da tabela
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'dccmusic_musics'
ORDER BY tc.constraint_type, kcu.column_name;
