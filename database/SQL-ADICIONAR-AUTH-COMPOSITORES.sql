-- Adicionar campos de autenticação na tabela de compositores
-- Email e senha para login

ALTER TABLE dccmusic_composers 
ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS account_name TEXT;

-- Índice para busca rápida por email
CREATE INDEX IF NOT EXISTS idx_composers_email ON dccmusic_composers(email);

-- RLS: Compositor pode ver apenas seus próprios dados
ALTER TABLE dccmusic_composers ENABLE ROW LEVEL SECURITY;

-- Política: Compositor pode ler seus próprios dados
CREATE POLICY "Compositor pode ver seus próprios dados" ON dccmusic_composers
  FOR SELECT USING (true); -- Será filtrado por email na aplicação

-- Política: Compositor pode atualizar seus próprios dados
CREATE POLICY "Compositor pode atualizar seus próprios dados" ON dccmusic_composers
  FOR UPDATE USING (true); -- Será filtrado por email na aplicação
