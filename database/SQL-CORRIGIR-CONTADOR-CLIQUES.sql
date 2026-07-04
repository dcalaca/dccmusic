-- ============================================
-- Script para Corrigir Contador de Cliques
-- ============================================
-- Execute este script para corrigir o trigger e recalcular os contadores

-- 1. Corrigir a função do trigger (adicionar SELECT COUNT(*))
CREATE OR REPLACE FUNCTION update_link_click_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE dccmusic_tracked_links
  SET click_count = (
    SELECT COUNT(*) 
    FROM dccmusic_link_clicks 
    WHERE link_id = NEW.link_id
  ),
  updated_at = NOW()
  WHERE id = NEW.link_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Recriar o trigger (caso não exista)
DROP TRIGGER IF EXISTS trigger_update_link_click_count ON dccmusic_link_clicks;
CREATE TRIGGER trigger_update_link_click_count
AFTER INSERT ON dccmusic_link_clicks
FOR EACH ROW
EXECUTE FUNCTION update_link_click_count();

-- 3. Recalcular TODOS os contadores existentes
UPDATE dccmusic_tracked_links
SET click_count = (
  SELECT COUNT(*) 
  FROM dccmusic_link_clicks 
  WHERE link_id = dccmusic_tracked_links.id
),
updated_at = NOW();

-- 4. Verificar resultado (opcional - descomente para ver)
-- SELECT 
--   tl.id,
--   tl.title,
--   tl.short_code,
--   tl.click_count,
--   COUNT(lc.id) as cliques_reais
-- FROM dccmusic_tracked_links tl
-- LEFT JOIN dccmusic_link_clicks lc ON tl.id = lc.link_id
-- GROUP BY tl.id, tl.title, tl.short_code, tl.click_count
-- ORDER BY tl.created_at DESC;
