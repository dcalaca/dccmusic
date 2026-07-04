-- ============================================
-- Corrigir RLS para permitir leitura de cliques via service role
-- ============================================

-- Remover políticas antigas que podem estar bloqueando
DROP POLICY IF EXISTS "Permitir leitura de cliques do próprio link" ON dccmusic_link_clicks;
DROP POLICY IF EXISTS "Permitir leitura completa de cliques para service role" ON dccmusic_link_clicks;

-- Criar política que permite leitura completa (service role bypassa RLS, mas isso garante compatibilidade)
-- A service role key já bypassa RLS, mas vamos garantir que não há conflitos
CREATE POLICY "Permitir leitura completa de cliques para service role"
ON dccmusic_link_clicks
FOR SELECT
USING (true);

-- Também garantir que a tabela de links permite leitura completa para service role
DROP POLICY IF EXISTS "Permitir leitura de links ativos" ON dccmusic_tracked_links;
DROP POLICY IF EXISTS "Permitir leitura completa de links" ON dccmusic_tracked_links;

CREATE POLICY "Permitir leitura completa de links"
ON dccmusic_tracked_links
FOR SELECT
USING (true);

-- Permitir DELETE de links (necessário para deletar via service role)
DROP POLICY IF EXISTS "Permitir deleção de links" ON dccmusic_tracked_links;
DROP POLICY IF EXISTS "Permitir atualização de links próprios" ON dccmusic_tracked_links;
DROP POLICY IF EXISTS "Permitir atualização de links" ON dccmusic_tracked_links;

CREATE POLICY "Permitir deleção de links"
ON dccmusic_tracked_links
FOR DELETE
USING (true);

CREATE POLICY "Permitir atualização de links"
ON dccmusic_tracked_links
FOR UPDATE
USING (true)
WITH CHECK (true);
