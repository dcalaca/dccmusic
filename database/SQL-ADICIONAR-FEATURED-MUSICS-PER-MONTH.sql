-- Adicionar coluna featured_musics_per_month na tabela de planos
-- Esta coluna define quantas músicas em destaque o usuário pode ter por mês

ALTER TABLE dccmusic_plans
ADD COLUMN IF NOT EXISTS featured_musics_per_month INTEGER DEFAULT NULL;

-- Comentário na coluna
COMMENT ON COLUMN dccmusic_plans.featured_musics_per_month IS 'Quantidade de músicas em destaque que o usuário pode ter por mês. NULL significa ilimitado.';
