-- ============================================
-- SQL PARA ADICIONAR CAMPOS DO PLANO OURO
-- DCC Music - Execute no SQL Editor do Supabase
-- ============================================
-- Adiciona campos para controlar vantagens especiais dos planos
-- ============================================

-- Adicionar colunas para vantagens do plano
ALTER TABLE dccmusic_plans
ADD COLUMN IF NOT EXISTS featured_musics_per_month INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS has_priority_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_gold_badge BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_premium_layout BOOLEAN DEFAULT false;

-- Comentários nas colunas
COMMENT ON COLUMN dccmusic_plans.featured_musics_per_month IS 'Quantidade de músicas em destaque que o usuário pode ter por mês. NULL significa ilimitado.';
COMMENT ON COLUMN dccmusic_plans.has_priority_featured IS 'Se true, os destaques deste plano aparecem com prioridade sobre planos básicos';
COMMENT ON COLUMN dccmusic_plans.has_gold_badge IS 'Se true, o compositor recebe selo "Artista Ouro" no perfil';
COMMENT ON COLUMN dccmusic_plans.has_premium_layout IS 'Se true, o compositor tem acesso a layout premium na página do artista';

-- Verificar se as colunas foram criadas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'dccmusic_plans'
  AND column_name IN ('featured_musics_per_month', 'has_priority_featured', 'has_gold_badge', 'has_premium_layout')
ORDER BY column_name;
