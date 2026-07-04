-- ============================================
-- SQL PARA VERIFICAR ESTRUTURA DA TABELA
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================
-- Use este script para verificar a estrutura real da tabela dccmusic_users
-- antes de executar o SQL-RECRIAR-USUARIO-ADMIN.sql
-- ============================================

-- Ver todas as colunas da tabela dccmusic_users
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'dccmusic_users'
ORDER BY ordinal_position;

-- Ver constraints da tabela
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' 
  AND table_name = 'dccmusic_users';

-- Ver se há triggers na tabela
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public' 
  AND event_object_table = 'dccmusic_users';
