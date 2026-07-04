-- ============================================
-- SQL PARA RESETAR SENHA PARA "123"
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================
-- Este script reseta a senha de um usuário ou compositor para "123"
-- O usuário/compositor precisará criar uma nova senha ao fazer login
-- ============================================

-- Hash da senha "123" gerado com bcrypt (10 rounds)
-- Hash: $2a$10$rOtd7S7nLOOeyye7zu9iqOsl1ReS0wanCvn2btLjjN4Ij2EncUWr6

-- ============================================
-- RESETAR SENHA DE USUÁRIO (site_users)
-- ============================================
-- IMPORTANTE: Substitua 'email@exemplo.com' pelo email do usuário que deseja resetar
UPDATE dccmusic_site_users
SET password_hash = '$2a$10$rOtd7S7nLOOeyye7zu9iqOsl1ReS0wanCvn2btLjjN4Ij2EncUWr6'
WHERE email = 'email@exemplo.com';

-- Verificar se foi atualizado
SELECT 
  id,
  name,
  email,
  LEFT(password_hash, 30) as hash_preview,
  updated_at
FROM dccmusic_site_users
WHERE email = 'email@exemplo.com';

-- ============================================
-- RESETAR SENHA DE COMPOSITOR
-- ============================================
-- IMPORTANTE: Substitua 'email@exemplo.com' pelo email do compositor que deseja resetar
UPDATE dccmusic_composers
SET password_hash = '$2a$10$rOtd7S7nLOOeyye7zu9iqOsl1ReS0wanCvn2btLjjN4Ij2EncUWr6'
WHERE email = 'email@exemplo.com';

-- Verificar se foi atualizado
SELECT 
  id,
  name,
  email,
  LEFT(password_hash, 30) as hash_preview,
  updated_at
FROM dccmusic_composers
WHERE email = 'email@exemplo.com';

-- ============================================
-- EXEMPLO: Resetar senha do usuário Leandro
-- ============================================
-- Se você souber o email do Leandro, substitua abaixo:
-- UPDATE dccmusic_site_users
-- SET password_hash = '$2a$10$rOtd7S7nLOOeyye7zu9iqOsl1ReS0wanCvn2btLjjN4Ij2EncUWr6'
-- WHERE email = 'email_do_leandro@exemplo.com';

-- ============================================
-- EXEMPLO: Resetar senha de um compositor
-- ============================================
-- UPDATE dccmusic_composers
-- SET password_hash = '$2a$10$rOtd7S7nLOOeyye7zu9iqOsl1ReS0wanCvn2btLjjN4Ij2EncUWr6'
-- WHERE email = 'email_do_compositor@exemplo.com';
