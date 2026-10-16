create table public.prospect_campaigns (
 id uuid primary key default gen_random_uuid(), name text not null, subject text not null, body text not null,
 status text not null default 'draft' check(status in ('draft','sending','paused','sent')),
 import_complete boolean not null default false, created_at timestamptz not null default now()
);
create table public.prospect_contacts (
 id uuid primary key default gen_random_uuid(), email text not null unique check(email=lower(trim(email))), name text not null default ''
);
create table public.prospect_deliveries (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.prospect_campaigns(id),
 contact_id uuid not null references public.prospect_contacts(id), email text not null, name text not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','skipped','uncertain')),
 claimed_at timestamptz, provider_id text, error text,
 unique(campaign_id,contact_id), unique(campaign_id,email)
);
create index prospect_queue on public.prospect_deliveries(campaign_id,status);
alter table public.prospect_campaigns enable row level security;
alter table public.prospect_contacts enable row level security;
alter table public.prospect_deliveries enable row level security;
revoke all on public.prospect_campaigns, public.prospect_contacts, public.prospect_deliveries from anon, authenticated;
grant all on public.prospect_campaigns, public.prospect_contacts, public.prospect_deliveries to service_role;
create function public.import_prospect_chunk(cid uuid, contacts jsonb) returns void language plpgsql set search_path=public as $$
begin
 perform 1 from prospect_campaigns where id=cid and status='draft' for update;
 if not found then raise exception 'Campanha já iniciada ou inexistente'; end if;
 insert into prospect_contacts(email,name) select lower(trim(x.email)),coalesce(x.name,'') from jsonb_to_recordset(contacts) as x(email text,name text) on conflict(email) do nothing;
 insert into prospect_deliveries(campaign_id,contact_id,email,name)
 select cid,c.id,c.email,coalesce(x.name,'') from jsonb_to_recordset(contacts) as x(email text,name text) join prospect_contacts c on c.email=lower(trim(x.email)) on conflict do nothing;
end $$;
create function public.claim_prospect_batch(cid uuid) returns setof public.prospect_deliveries language plpgsql set search_path=public as $$
begin
 perform 1 from prospect_campaigns where id=cid and status='sending' for update;
 if not found then return; end if;
 return query update prospect_deliveries set status='processing',claimed_at=now() where id in
 (select id from prospect_deliveries where campaign_id=cid and status='pending' order by id limit 10 for update skip locked) returning *;
end $$;
revoke all on function public.import_prospect_chunk(uuid,jsonb), public.claim_prospect_batch(uuid) from public,anon,authenticated;
grant execute on function public.import_prospect_chunk(uuid,jsonb), public.claim_prospect_batch(uuid) to service_role;
create function public.prospect_delivery_stats(cid uuid) returns jsonb language sql stable set search_path=public as $$
 select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from (select status,count(*) n from prospect_deliveries where campaign_id=cid group by status) s;
$$;
revoke all on function public.prospect_delivery_stats(uuid) from public,anon,authenticated;
grant execute on function public.prospect_delivery_stats(uuid) to service_role;
