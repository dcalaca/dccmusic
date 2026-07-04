-- ============================================================
-- DCC Studio IA - Sistema de Cupons
-- ============================================================
-- Cole este script inteiro no Supabase: menu lateral > SQL Editor > New query > colar > Run.
-- Cria a tabela de cupons usada pela página /admin/cupons e pelo resgate no /studio-ia.
-- ============================================================

create table if not exists studio_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  music_quantity integer not null check (music_quantity > 0),
  -- preço em reais. 0 = cupom grátis (credita na hora, sem pagamento).
  price numeric(10, 2) not null default 0 check (price >= 0),
  -- quantas vezes o cupom pode ser usado no total.
  max_uses integer not null default 1 check (max_uses > 0),
  -- quantas vezes já foi usado.
  used_count integer not null default 0 check (used_count >= 0),
  -- validade opcional. null = sem prazo (ativo até desativar).
  expires_at timestamptz,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_studio_coupons_code on studio_coupons (code);
create index if not exists idx_studio_coupons_active on studio_coupons (active);

-- Observação: o resgate registra o crédito em studio_credit_transactions
-- com action = 'coupon_redemption' (grátis) ou 'credit_topup' (pago, via recarga),
-- então não precisa de tabela extra de histórico.
