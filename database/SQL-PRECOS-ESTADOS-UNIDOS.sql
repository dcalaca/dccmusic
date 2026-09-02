-- Cadastro inicial dos Estados Unidos. Depois desta carga, todos os valores
-- são administrados exclusivamente em /admin/precos e lidos destas tabelas.

insert into public.studio_topup_pricing
  (country, currency, min_quantity, max_quantity, unit_price, label, is_active)
select values_to_insert.*
from (values
  ('US', 'USD', 1, 1, 2.99, '1 song', true),
  ('US', 'USD', 2, 8, 2.49, '2 to 8 songs', true),
  ('US', 'USD', 9, 13, 2.34, '9 to 13 songs', true),
  ('US', 'USD', 14, 29, 2.34, '14 to 29 songs', true),
  ('US', 'USD', 30, null, 1.99, '30+ songs', true)
) as values_to_insert(country, currency, min_quantity, max_quantity, unit_price, label, is_active)
where not exists (
  select 1
  from public.studio_topup_pricing existing
  where existing.country = values_to_insert.country
    and existing.min_quantity = values_to_insert.min_quantity
);

insert into public.studio_plan_country_pricing
  (plan_slug, country, currency, price, is_active)
select values_to_insert.*
from (values
  ('studio-start', 'US', 'USD', 19.90, true),
  ('studio-pro', 'US', 'USD', 29.90, true),
  ('studio-elite', 'US', 'USD', 59.90, true),
  ('dcc-studio-ia', 'US', 'USD', 19.90, true)
) as values_to_insert(plan_slug, country, currency, price, is_active)
where not exists (
  select 1
  from public.studio_plan_country_pricing existing
  where existing.country = values_to_insert.country
    and existing.plan_slug = values_to_insert.plan_slug
);
