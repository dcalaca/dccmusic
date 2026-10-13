-- Referral acquisition is independent of existing ad attribution and click IDs.
alter table public.studio_credit_topups add column referral_source text check (referral_source is null or referral_source='indicacao');
alter table public.dccmusic_payments add column referral_source text check (referral_source is null or referral_source='indicacao');

create function public.dcc_referral_sale_origin()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.dcc_referrals r where r.referee_id=new.composer_id and new.created_at >= r.registered_at) then
    new.referral_source := 'indicacao';
  else
    new.referral_source := null;
  end if;
  return new;
exception when others then
  raise warning 'DCC referral origin observer failed: %',SQLERRM;
  return new;
end;
$$;
revoke all on function public.dcc_referral_sale_origin() from public,anon,authenticated;
grant execute on function public.dcc_referral_sale_origin() to service_role;
create trigger dcc_referral_sale_origin before insert or update of composer_id,status on public.studio_credit_topups for each row execute function public.dcc_referral_sale_origin();
create trigger dcc_referral_sale_origin before insert or update of composer_id,status on public.dccmusic_payments for each row execute function public.dcc_referral_sale_origin();
update public.studio_credit_topups p set referral_source='indicacao' from public.dcc_referrals r where r.referee_id=p.composer_id and p.created_at >= r.registered_at and p.referral_source is distinct from 'indicacao';
update public.dccmusic_payments p set referral_source='indicacao' from public.dcc_referrals r where r.referee_id=p.composer_id and p.created_at >= r.registered_at and p.referral_source is distinct from 'indicacao';
