-- ============================================
-- SQL PARA ATUALIZAR USUÁRIO ADMIN
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================
-- Este script atualiza a senha do usuário existente (sem deletar)
-- IMPORTANTE: Não deleta o usuário para evitar problemas com foreign keys
-- ============================================

-- ATUALIZAR senha do usuário existente
-- Hash da senha "5778" gerado com bcrypt (10 rounds) - GERADO E VALIDADO ✅
-- Hash: $2a$10$xeUH8BRTuZQdvQpXv9eQX.WLllKIL5mvE1ki3.i/8S6HkjJgU2GAq
UPDATE dccmusic_users
SET 
  password_hash = '$2a$10$xeUH8BRTuZQdvQpXv9eQX.WLllKIL5mvE1ki3.i/8S6HkjJgU2GAq',
  name = 'DCC Admin'
WHERE email = 'dcalaca@gmail.com';

-- Se o usuário não existir, criar (INSERT só acontece se o UPDATE não afetou nenhuma linha)
INSERT INTO dccmusic_users (email, password_hash, name)
SELECT 
  'dcalaca@gmail.com',
  '$2a$10$xeUH8BRTuZQdvQpXv9eQX.WLllKIL5mvE1ki3.i/8S6HkjJgU2GAq',
  'DCC Admin'
WHERE NOT EXISTS (
  SELECT 1 FROM dccmusic_users WHERE email = 'dcalaca@gmail.com'
);

-- Verificar se foi atualizado corretamente
SELECT 
  id, 
  email, 
  name, 
  LENGTH(password_hash) as hash_length,
  LEFT(password_hash, 30) as hash_preview,
  created_at 
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
