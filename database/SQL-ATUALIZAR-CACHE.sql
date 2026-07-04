-- ============================================
-- SQL PARA ATUALIZAR SCHEMA CACHE DO SUPABASE
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script força a atualização do schema cache do PostgREST
-- ============================================

-- Notificar PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';

-- Verificar se as tabelas existem
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'dccmusic_%'
ORDER BY table_name;

-- Verificar colunas da tabela dccmusic_users
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'dccmusic_users'
ORDER BY ordinal_position;
