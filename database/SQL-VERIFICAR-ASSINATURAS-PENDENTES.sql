-- Verificar assinaturas pendentes no banco
-- Execute este SQL para ver todas as assinaturas pendentes

SELECT 
  s.id,
  s.composer_id,
  c.name as composer_name,
  c.email as composer_email,
  s.plan_id,
  p.name as plan_name,
  s.status,
  s.start_date,
  s.end_date,
  s.payment_id,
  s.created_at
FROM dccmusic_subscriptions s
LEFT JOIN dccmusic_composers c ON s.composer_id = c.id
LEFT JOIN dccmusic_plans p ON s.plan_id = p.id
WHERE s.status = 'pending'
ORDER BY s.created_at DESC;

-- Verificar se há duplicatas (mesmo compositor + plano + status)
SELECT 
  composer_id,
  plan_id,
  status,
  COUNT(*) as quantidade
FROM dccmusic_subscriptions
WHERE status = 'pending'
GROUP BY composer_id, plan_id, status
HAVING COUNT(*) > 1;
