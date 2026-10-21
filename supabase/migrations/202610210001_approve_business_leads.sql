begin;

alter table public.business_leads
  add column if not exists business_id uuid references public.businesses(id);

create unique index if not exists business_leads_business_id_key
  on public.business_leads(business_id) where business_id is not null;

create table if not exists public.platform_business_approvers (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.platform_business_approvers enable row level security;

-- Grant the approval role automatically only when exactly one existing
-- authenticated owner matches. Multiple owners require an explicit choice.
with owner_candidates as (
  select distinct auth_user.id
  from auth.users auth_user
  join public.app_users app_user on lower(app_user.email) = lower(auth_user.email)
  where app_user.account_type = 'business'
    and app_user.business_role = 'owner'
    and app_user.active = true
)
insert into public.platform_business_approvers(user_id)
select id from owner_candidates
where (select count(*) from owner_candidates) = 1
on conflict do nothing;

drop policy if exists "Approvers can read their own authorization"
on public.platform_business_approvers;
create policy "Approvers can read their own authorization"
on public.platform_business_approvers for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Demo can read business leads" on public.business_leads;
drop policy if exists "Approvers can read business leads" on public.business_leads;
create policy "Approvers can read business leads"
on public.business_leads for select
to authenticated
using (
  exists (
    select 1 from public.platform_business_approvers approver
    where approver.user_id = auth.uid()
  )
);

create or replace function public.approve_business_lead(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lead_record public.business_leads%rowtype;
  new_business_id uuid;
  business_slug text;
  owner_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.platform_business_approvers approver
    where approver.user_id = auth.uid()
  ) then
    raise exception 'No tienes permiso para aprobar comercios.';
  end if;

  select * into lead_record
  from public.business_leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'La solicitud no existe.';
  end if;
  if lead_record.business_id is not null then
    return lead_record.business_id;
  end if;
  if lead_record.status = 'rejected' then
    raise exception 'No se puede aprobar una solicitud rechazada.';
  end if;

  business_slug := trim(both '-' from regexp_replace(
    translate(lower(lead_record.business_name), 'áéíóúñü', 'aeiounu'),
    '[^a-z0-9]+', '-', 'g'
  ));
  if business_slug = '' then
    business_slug := 'comercio';
  end if;
  business_slug := business_slug || '-' || left(replace(lead_record.id::text, '-', ''), 8);

  select id into owner_id from auth.users
  where lower(email) = lower(lead_record.email)
  limit 1;

  insert into public.businesses
    (slug, name, category, description, address, city, owner_user_id)
  values
    (business_slug, trim(lead_record.business_name),
     coalesce(nullif(trim(lead_record.category), ''), 'Otros'),
     nullif(trim(lead_record.message), ''), nullif(trim(lead_record.city), ''),
     nullif(trim(lead_record.city), ''), owner_id)
  returning id into new_business_id;

  update public.business_leads
  set status = 'approved', business_id = new_business_id
  where id = p_lead_id;

  return new_business_id;
end;
$$;

revoke all on function public.approve_business_lead(uuid) from public, anon;
grant execute on function public.approve_business_lead(uuid) to authenticated;

commit;
