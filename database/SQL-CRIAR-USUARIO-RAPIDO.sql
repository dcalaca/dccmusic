-- ============================================
-- SQL RÁPIDO PARA CRIAR USUÁRIO ADMIN
-- Execute no Supabase SQL Editor
-- ============================================

-- Criar ou atualizar usuário dcalaca@gmail.com com senha 5778
-- Hash da senha "5778" gerado com bcrypt (10 rounds) - TESTADO E VALIDADO ✅
-- Hash: $2a$10$rOtd7S7nLOOeyye7zu9iqOsl1ReS0wanCvn2btLjjN4Ij2EncUWr6

-- Primeiro, verificar se o usuário existe e atualizar se existir
UPDATE dccmusic_users
SET password_hash = '$2a$10$rOtd7S7nLOOeyye7zu9iqOsl1ReS0wanCvn2btLjjN4Ij2EncUWr6',
    name = 'DCC Admin'
WHERE email = 'dcalaca@gmail.com';

-- Se não existir, inserir (INSERT só acontece se o UPDATE não afetou nenhuma linha)
INSERT INTO dccmusic_users (email, password_hash, name)
SELECT 
  'dcalaca@gmail.com',
  '$2a$10$rOtd7S7nLOOeyye7zu9iqOsl1ReS0wanCvn2btLjjN4Ij2EncUWr6',
  'DCC Admin'
WHERE NOT EXISTS (
  SELECT 1 FROM dccmusic_users WHERE email = 'dcalaca@gmail.com'
);

-- Verificar
SELECT email, name FROM dccmusic_users WHERE email = 'dcalaca@gmail.com';
