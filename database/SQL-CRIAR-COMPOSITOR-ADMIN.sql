-- ============================================
-- SQL PARA CRIAR COMPOSITOR PARA O ADMIN
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================
-- Este script cria um compositor com o mesmo email do admin
-- para que você possa fazer login como compositor também
-- ============================================

-- Hash da senha "5778" gerado com bcrypt (10 rounds) - TESTADO E VALIDADO ✅
-- Hash: $2a$10$xeUH8BRTuZQdvQpXv9eQX.WLllKIL5mvE1ki3.i/8S6HkjJgU2GAq

-- Primeiro, verificar se já existe um compositor com esse email OU nome
SELECT id, name, email FROM dccmusic_composers 
WHERE email = 'dcalaca@gmail.com' OR name = 'Douglas Calaça';

-- Estratégia: Atualizar o compositor existente (por email ou por nome)
-- Se existir por email, atualizar
UPDATE dccmusic_composers
SET 
  password_hash = '$2a$10$xeUH8BRTuZQdvQpXv9eQX.WLllKIL5mvE1ki3.i/8S6HkjJgU2GAq',
  is_premium = true,
  has_active_subscription = true,
  subscription_expires_at = NOW() + INTERVAL '10 years',
  email = 'dcalaca@gmail.com'
WHERE email = 'dcalaca@gmail.com';

-- Se não existir por email mas existir por nome similar, atualizar também
-- (pode ser "Douglas Calaca" sem ç)
UPDATE dccmusic_composers
SET 
  password_hash = '$2a$10$xeUH8BRTuZQdvQpXv9eQX.WLllKIL5mvE1ki3.i/8S6HkjJgU2GAq',
  is_premium = true,
  has_active_subscription = true,
  subscription_expires_at = NOW() + INTERVAL '10 years',
  email = 'dcalaca@gmail.com'
WHERE (name ILIKE 'Douglas Calac%' OR name = 'Douglas Calaca')
  AND (email IS NULL OR email != 'dcalaca@gmail.com');

-- Se ainda não existir nenhum, criar novo
INSERT INTO dccmusic_composers (
  name,
  slug,
  email,
  password_hash,
  is_premium,
  has_active_subscription,
  subscription_expires_at
)
SELECT 
  'Douglas Calaça',
  'douglas-calaca',
  'dcalaca@gmail.com',
  '$2a$10$xeUH8BRTuZQdvQpXv9eQX.WLllKIL5mvE1ki3.i/8S6HkjJgU2GAq',
  true,
  true,
  NOW() + INTERVAL '10 years'
WHERE NOT EXISTS (
  SELECT 1 FROM dccmusic_composers 
  WHERE email = 'dcalaca@gmail.com' OR name = 'Douglas Calaça'
);

-- Verificar se foi criado/atualizado
SELECT 
  id,
  name,
  email,
  slug,
  is_premium,
  has_active_subscription,
  subscription_expires_at,
  created_at
FROM dccmusic_composers 
WHERE email = 'dcalaca@gmail.com';
