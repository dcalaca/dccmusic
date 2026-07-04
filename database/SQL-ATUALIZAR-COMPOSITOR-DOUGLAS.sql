-- ============================================
-- SQL PARA ATUALIZAR COMPOSITOR DOUGLAS CALACA
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================
-- Este script atualiza o compositor existente "Douglas Calaca"
-- para ter a senha correta e status premium
-- ============================================

-- Hash da senha "5778" gerado com bcrypt (10 rounds) - TESTADO E VALIDADO ✅
-- Hash: $2a$10$xeUH8BRTuZQdvQpXv9eQX.WLllKIL5mvE1ki3.i/8S6HkjJgU2GAq

-- Atualizar o compositor existente (pode ser "Douglas Calaca" ou "Douglas Calaça")
UPDATE dccmusic_composers
SET 
  password_hash = '$2a$10$xeUH8BRTuZQdvQpXv9eQX.WLllKIL5mvE1ki3.i/8S6HkjJgU2GAq',
  is_premium = true,
  has_active_subscription = true,
  subscription_expires_at = NOW() + INTERVAL '10 years',
  email = 'dcalaca@gmail.com'
WHERE email = 'dcalaca@gmail.com'
   OR name ILIKE 'Douglas Calac%';

-- Verificar se foi atualizado corretamente
SELECT 
  id,
  name,
  email,
  slug,
  is_premium,
  has_active_subscription,
  subscription_expires_at,
  LEFT(password_hash, 30) as hash_preview,
  created_at
FROM dccmusic_composers 
WHERE email = 'dcalaca@gmail.com' OR name ILIKE 'Douglas Calac%';
