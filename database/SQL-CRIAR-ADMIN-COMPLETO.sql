-- ============================================
-- SQL PARA CRIAR/ATUALIZAR USUÁRIO ADMIN COMPLETO
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================
-- Este script garante que o admin existe na tabela dccmusic_users
-- e pode fazer login mesmo sem variáveis de ambiente configuradas
-- ============================================

-- Hash da senha "5778" gerado com bcrypt (10 rounds) - TESTADO E VALIDADO ✅
-- Hash: $2a$10$xeUH8BRTuZQdvQpXv9eQX.WLllKIL5mvE1ki3.i/8S6HkjJgU2GAq

-- Primeiro, garantir que a coluna password_hash existe (se não existir, criar)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'dccmusic_users' 
    AND column_name = 'password_hash'
  ) THEN
    -- Se não existir password_hash, adicionar
    ALTER TABLE dccmusic_users ADD COLUMN password_hash TEXT;
  END IF;
END $$;

-- Primeiro, tentar atualizar se o usuário já existe
UPDATE dccmusic_users
SET 
  password_hash = '$2a$10$xeUH8BRTuZQdvQpXv9eQX.WLllKIL5mvE1ki3.i/8S6HkjJgU2GAq',
  name = 'DCC Admin',
  updated_at = NOW()
WHERE email = 'dcalaca@gmail.com';

-- Se não existir, criar (INSERT só acontece se o UPDATE não afetou nenhuma linha)
INSERT INTO dccmusic_users (email, password_hash, name)
SELECT 
  'dcalaca@gmail.com',
  '$2a$10$xeUH8BRTuZQdvQpXv9eQX.WLllKIL5mvE1ki3.i/8S6HkjJgU2GAq',
  'DCC Admin'
WHERE NOT EXISTS (
  SELECT 1 FROM dccmusic_users WHERE email = 'dcalaca@gmail.com'
);

-- Verificar se foi criado/atualizado corretamente
SELECT 
  id, 
  email, 
  name, 
  LENGTH(password_hash) as hash_length,
  LEFT(password_hash, 30) as hash_preview,
  created_at,
  updated_at
FROM dccmusic_users 
WHERE email = 'dcalaca@gmail.com';

-- Verificar se o hash está completo (deve ter 60 caracteres)
SELECT 
  email,
  LENGTH(password_hash) as hash_length,
  CASE 
    WHEN LENGTH(password_hash) = 60 THEN '✅ Hash completo'
    WHEN LENGTH(password_hash) < 60 THEN '⚠️ Hash pode estar truncado'
    ELSE '❌ Hash com tamanho inesperado'
  END as status_hash
FROM dccmusic_users 
WHERE email = 'dcalaca@gmail.com';
