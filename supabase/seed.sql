-- ============================================
-- Seed SQL para Supabase - DCC Music
-- Execute este SQL após criar as tabelas
-- ============================================

-- Inserir usuário admin (senha: admin123 - hash bcrypt)
-- IMPORTANTE: Gere o hash com bcrypt antes de inserir
-- Você pode usar: https://bcrypt-generator.com/ ou rodar o seed.ts
INSERT INTO dccmusic_users (email, password, name) VALUES
('admin@dccmusic.com', '$2a$10$rOzJqZqZqZqZqZqZqZqZqOZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq', 'Admin')
ON CONFLICT (email) DO NOTHING;

-- Inserir gêneros
INSERT INTO dccmusic_genres (name, slug, color) VALUES
('Pop', 'pop', '#ff6b9d'),
('Rock', 'rock', '#ff4757'),
('EDM', 'edm', '#5f27cd'),
('Hip Hop', 'hip-hop', '#00d2d3'),
('R&B', 'r-b', '#ff9ff3')
ON CONFLICT (slug) DO NOTHING;

-- NOTA: Para inserir vídeos e músicas de exemplo, use o seed.ts
-- ou insira manualmente após criar o usuário admin
