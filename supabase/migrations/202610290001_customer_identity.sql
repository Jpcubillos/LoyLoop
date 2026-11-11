-- LL-39. Apply once to the shared Supabase project before releasing LL-11.
-- No loyalty balances or memberships are recreated. Abort on ambiguous emails.
begin;

do $$ begin
  if exists (
    select 1 from public.customer_profiles where email is not null
    group by lower(btrim(email)) having count(*) > 1
  ) then
    raise exception 'Resolve duplicate normalized customer emails before applying LL-39';
  end if;
end $$;
create unique index if not exists customer_profiles_normalized_email_key
  on public.customer_profiles(lower(btrim(email))) where email is not null;

create table if not exists public.customer_identities (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id uuid not null unique references public.customer_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.customer_identities enable row level security;
revoke all on public.customer_identities from public, anon, authenticated;
grant select on public.customer_identities to authenticated;
drop policy if exists "Customers read their identity" on public.customer_identities;
create policy "Customers read their identity" on public.customer_identities
  for select to authenticated using (auth_user_id = (select auth.uid()));

create or replace function public.ensure_loyloop_customer_identity()
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  user_id uuid := auth.uid();
  verified_email text;
  profile_name text;
  profile_id uuid;
begin
  if user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select lower(btrim(u.email)), coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), 'Cliente LoyLoop')
    into verified_email, profile_name from auth.users u
    where u.id = user_id and u.email_confirmed_at is not null;
  if verified_email is null then raise exception 'Verified identity required' using errcode = '42501'; end if;

  -- Serialize requests from this identity, then from the verified email. This
  -- also handles two devices entering for the first time without duplicate rows.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(user_id::text, 39));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(verified_email, 40));
  select i.customer_id into profile_id from public.customer_identities i where i.auth_user_id = user_id;
  if profile_id is not null then
    update public.customer_profiles set email = verified_email where id = profile_id and email is distinct from verified_email;
    return profile_id;
  end if;

  -- Verified email proves ownership when migrating the legacy email-linked
  -- profile. Preserve that row's id, memberships, stamps and balances.
  select p.id into profile_id from public.customer_profiles p
    where lower(btrim(p.email)) = verified_email for update;
  if profile_id is null then
    insert into public.customer_profiles(email, full_name) values (verified_email, profile_name)
      on conflict (lower(btrim(email))) where email is not null do nothing
      returning id into profile_id;
    if profile_id is null then
      select p.id into profile_id from public.customer_profiles p where lower(btrim(p.email)) = verified_email for update;
    end if;
  end if;
  if exists (select 1 from public.customer_identities i where i.customer_id = profile_id and i.auth_user_id <> user_id) then
    raise exception 'Identity conflict' using errcode = '42501';
  end if;
  insert into public.customer_identities(auth_user_id, customer_id) values (user_id, profile_id);
  return profile_id;
end;
$$;
revoke all on function public.ensure_loyloop_customer_identity() from public, anon;
grant execute on function public.ensure_loyloop_customer_identity() to authenticated;

commit;
