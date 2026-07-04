-- ============================================
-- SQL PARA VERIFICAR CONSTRAINTS FINAIS
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script verifica se há constraints ou triggers
-- que possam estar interferindo nas operações
-- ============================================

-- Verificar todas as constraints nas tabelas
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  tc.is_deferrable,
  tc.initially_deferred
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_name IN ('dccmusic_videos', 'dccmusic_musics')
  AND (kcu.column_name IN ('genre', 'genre_id') OR kcu.column_name IS NULL)
ORDER BY tc.table_name, tc.constraint_type, kcu.column_name;

-- Verificar triggers relacionados
SELECT 
  trigger_name,
  event_object_table,
  action_statement,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN ('dccmusic_videos', 'dccmusic_musics')
  AND (trigger_name LIKE '%genre%' OR action_statement LIKE '%genre%')
ORDER BY event_object_table, trigger_name;

-- Verificar estrutura final das colunas
SELECT 
  table_name,
  column_name, 
  data_type, 
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_name IN ('dccmusic_videos', 'dccmusic_musics')
  AND column_name IN ('genre', 'genre_id')
ORDER BY table_name, column_name;

-- Verificar índices relacionados
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('dccmusic_videos', 'dccmusic_musics')
  AND (indexdef LIKE '%genre%' OR indexname LIKE '%genre%')
ORDER BY tablename, indexname;

-- ============================================
-- RESUMO ESPERADO:
-- - genre: TEXT, nullable (YES), sem default
-- - genre_id: UUID, nullable (YES), sem default
-- - Nenhuma constraint NOT NULL em genre_id
-- - Nenhuma foreign key ativa em genre_id
-- - Nenhum trigger interferindo
-- ============================================
