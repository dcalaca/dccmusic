-- ============================================
-- SQL PARA ADICIONAR USUÁRIO ADMIN
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Este script adiciona o usuário dcalaca@gmail.com
-- IMPORTANTE: A senha será hashada pelo seed ou você pode usar bcrypt
-- ============================================

-- Inserir usuário (senha será hashada pelo seed)
-- Se você quiser inserir manualmente, precisa gerar o hash da senha "5778" primeiro
-- Use: npm run db:seed (que já faz isso automaticamente)

-- Ou execute este SQL após gerar o hash (exemplo com bcrypt):
-- INSERT INTO dccmusic_users (email, password, name)
-- VALUES (
--   'dcalaca@gmail.com',
--   '$2a$10$...', -- Substitua pelo hash gerado
--   'DCC Admin'
-- )
-- ON CONFLICT (email) DO NOTHING;

-- ============================================
-- RECOMENDAÇÃO: Use o seed automático
-- npm run db:seed
-- ============================================
