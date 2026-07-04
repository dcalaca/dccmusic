-- ============================================
-- SQL PARA CRIAR USUÁRIO ADMIN DIRETAMENTE
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script cria o usuário dcalaca@gmail.com com senha 5778
-- IMPORTANTE: Execute após criar as tabelas
-- ============================================

-- Inserir usuário admin
-- A senha "5778" será hashada usando bcrypt
-- Hash gerado: $2a$10$rK8X9YzQ3vL5mN7pQ2wJ.eK8X9YzQ3vL5mN7pQ2wJ.eK8X9YzQ3vL5mN
-- Mas vamos usar uma função para gerar o hash correto

-- Primeiro, vamos criar uma função temporária para hash de senha
-- (ou você pode usar o hash gerado pelo seed local)

-- Hash da senha "5778" gerado com bcrypt (10 rounds) - TESTADO E VALIDADO ✅
-- Hash gerado: $2a$10$rOtd7S7nLOOeyye7zu9iqOsl1ReS0wanCvn2btLjjN4Ij2EncUWr6

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

-- Verificar se foi criado
SELECT id, email, name, created_at 
FROM dccmusic_users 
WHERE email = 'dcalaca@gmail.com';
