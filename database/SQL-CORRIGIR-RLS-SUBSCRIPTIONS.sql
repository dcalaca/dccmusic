-- Corrigir RLS Policies para dccmusic_subscriptions e dccmusic_payments
-- Adicionar políticas que permitam INSERT e UPDATE

-- ============================================
-- ASSINATURAS (dccmusic_subscriptions)
-- ============================================

-- Política: Permitir INSERT (necessário para criar assinaturas)
DROP POLICY IF EXISTS "Permitir insert assinaturas" ON dccmusic_subscriptions;
CREATE POLICY "Permitir insert assinaturas" ON dccmusic_subscriptions
  FOR INSERT WITH CHECK (true);

-- Política: Permitir UPDATE (necessário para atualizar status)
DROP POLICY IF EXISTS "Permitir update assinaturas" ON dccmusic_subscriptions;
CREATE POLICY "Permitir update assinaturas" ON dccmusic_subscriptions
  FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================
-- PAGAMENTOS (dccmusic_payments)
-- ============================================

-- Política: Permitir INSERT em pagamentos
DROP POLICY IF EXISTS "Permitir insert pagamentos" ON dccmusic_payments;
CREATE POLICY "Permitir insert pagamentos" ON dccmusic_payments
  FOR INSERT WITH CHECK (true);

-- Política: Permitir UPDATE em pagamentos
DROP POLICY IF EXISTS "Permitir update pagamentos" ON dccmusic_payments;
CREATE POLICY "Permitir update pagamentos" ON dccmusic_payments
  FOR UPDATE USING (true) WITH CHECK (true);
