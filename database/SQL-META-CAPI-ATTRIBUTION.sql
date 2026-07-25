-- Persistência de atribuição Meta CAPI no checkout (fbp/fbc/IP/UA).
-- Rode no SQL Editor do Supabase (opcional para planos; recargas Studio já usam metadata existente).

alter table public.dccmusic_subscriptions
  add column if not exists metadata jsonb;

comment on column public.dccmusic_subscriptions.metadata is
  'Metadados auxiliares do checkout, incluindo meta_capi (fbp, fbc, IP, user-agent) para Conversions API.';
