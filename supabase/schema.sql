create extension if not exists "pgcrypto";

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  description text,
  address text,
  city text,
  logo_url text,
  qr_code_url text,
  vip_purchase_threshold integer not null default 30 check (vip_purchase_threshold > 0),
  at_risk_days integer not null default 90 check (at_risk_days > 0),
  inactive_days integer not null default 180 check (inactive_days > 0),
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.businesses add column if not exists vip_purchase_threshold integer not null default 30;
alter table public.businesses add column if not exists at_risk_days integer not null default 90;
alter table public.businesses add column if not exists inactive_days integer not null default 180;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text unique,
  email text unique,
  wallet_address text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  account_type text not null check (account_type in ('business', 'customer')),
  business_id uuid references public.businesses(id) on delete cascade,
  customer_id uuid references public.customer_profiles(id) on delete cascade,
  business_role text check (business_role is null or business_role in ('owner', 'manager', 'cashier')),
  customer_segment text check (customer_segment is null or customer_segment in ('inactive', 'at_risk', 'active', 'vip')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.business_leads (
  id uuid primary key default gen_random_uuid(),
  owner_name text not null,
  business_name text not null,
  email text not null,
  phone text,
  city text,
  category text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.business_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  credit_balance_cents integer not null default 0 check (credit_balance_cents >= 0),
  tier text not null default 'Nuevo',
  joined_at timestamptz not null default now(),
  unique (business_id, customer_id)
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  type text not null check (type in ('discount', 'points', 'credit', 'product')),
  description text,
  points_required integer check (points_required is null or points_required >= 0),
  credit_amount_cents integer check (credit_amount_cents is null or credit_amount_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null check (category in ('frequency', 'referral', 'offpeak', 'minipay', 'review')),
  description text,
  goal integer not null default 1 check (goal > 0),
  reward_points integer not null default 0 check (reward_points >= 0),
  audience_segment text not null default 'active' check (audience_segment in ('inactive', 'at_risk', 'active', 'vip')),
  duration_type text not null default 'indefinite' check (duration_type in ('indefinite', 'one_hour', 'custom')),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  type text not null check (type in ('discount_redeem', 'points_boost')),
  description text,
  discount_percent integer check (discount_percent is null or discount_percent between 1 and 100),
  reward_points integer not null default 0 check (reward_points >= 0),
  audience_segment text not null default 'active' check (audience_segment in ('inactive', 'at_risk', 'active', 'vip')),
  duration_type text not null default 'indefinite' check (duration_type in ('indefinite', 'one_hour', 'custom')),
  status text not null default 'active' check (status in ('active', 'scheduled', 'ended')),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.missions add column if not exists audience_segment text not null default 'active';
alter table public.missions add column if not exists duration_type text not null default 'indefinite';
alter table public.missions add column if not exists starts_at timestamptz;
alter table public.missions add column if not exists ends_at timestamptz;

alter table public.campaigns add column if not exists audience_segment text not null default 'active';
alter table public.campaigns add column if not exists duration_type text not null default 'indefinite';

create table if not exists public.customer_missions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (mission_id, customer_id)
);

create table if not exists public.stamp_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  reward_name text not null,
  current_stamps integer not null default 0 check (current_stamps >= 0),
  required_stamps integer not null default 10 check (required_stamps > 0),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (business_id, customer_id, reward_name)
);

create table if not exists public.loyalty_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  event_type text not null check (event_type in ('join', 'purchase', 'stamp', 'reward_redeem', 'mission_progress', 'mission_complete', 'credit_grant', 'credit_spend', 'minipay_payment')),
  points_delta integer not null default 0,
  credit_delta_cents integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  action_type text not null check (action_type in ('stamp_add', 'stamp_redeem', 'discount_redeem', 'points_boost')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_redemptions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  claim_request_id uuid references public.claim_requests(id) on delete set null,
  redeemed_at timestamptz not null default now(),
  unique (campaign_id, customer_id)
);

create index if not exists businesses_slug_idx on public.businesses(slug);
create index if not exists app_users_email_idx on public.app_users(email);
create index if not exists app_users_business_idx on public.app_users(business_id);
create index if not exists business_leads_status_idx on public.business_leads(status);
create index if not exists memberships_business_idx on public.business_memberships(business_id);
create index if not exists memberships_customer_idx on public.business_memberships(customer_id);
create index if not exists rewards_business_idx on public.rewards(business_id);
create index if not exists missions_business_idx on public.missions(business_id);
create index if not exists campaigns_business_idx on public.campaigns(business_id);
create index if not exists campaign_redemptions_customer_idx on public.campaign_redemptions(customer_id);
create index if not exists loyalty_events_business_customer_idx on public.loyalty_events(business_id, customer_id);
create index if not exists loyalty_events_created_at_idx on public.loyalty_events(created_at desc);
create index if not exists claim_requests_code_idx on public.claim_requests(code);
create index if not exists claim_requests_business_status_idx on public.claim_requests(business_id, status);

alter table public.businesses enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.app_users enable row level security;
alter table public.business_leads enable row level security;
alter table public.business_memberships enable row level security;
alter table public.rewards enable row level security;
alter table public.missions enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_redemptions enable row level security;
alter table public.customer_missions enable row level security;
alter table public.stamp_cards enable row level security;
alter table public.loyalty_events enable row level security;
alter table public.claim_requests enable row level security;

drop policy if exists "Public can read active businesses" on public.businesses;
create policy "Public can read active businesses"
on public.businesses for select
to anon, authenticated
using (true);

drop policy if exists "Demo can read app users" on public.app_users;
create policy "Demo can read app users"
on public.app_users for select
to anon, authenticated
using (true);

drop policy if exists "Demo can create app users" on public.app_users;
create policy "Demo can create app users"
on public.app_users for insert
to anon, authenticated
with check (true);

drop policy if exists "Demo can update app users" on public.app_users;
create policy "Demo can update app users"
on public.app_users for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Demo can insert business leads" on public.business_leads;
create policy "Demo can insert business leads"
on public.business_leads for insert
to anon, authenticated
with check (true);

drop policy if exists "Demo can read business leads" on public.business_leads;
create policy "Demo can read business leads"
on public.business_leads for select
to anon, authenticated
using (true);

drop policy if exists "Public can read rewards" on public.rewards;
create policy "Public can read rewards"
on public.rewards for select
to anon, authenticated
using (active = true);

drop policy if exists "Public can read missions" on public.missions;
create policy "Public can read missions"
on public.missions for select
to anon, authenticated
using (active = true);

drop policy if exists "Public can read campaigns" on public.campaigns;
create policy "Public can read campaigns"
on public.campaigns for select
to anon, authenticated
using (active = true);

drop policy if exists "Public can read demo campaign redemptions" on public.campaign_redemptions;
create policy "Public can read demo campaign redemptions"
on public.campaign_redemptions for select
to anon, authenticated
using (true);

drop policy if exists "Public can read demo memberships" on public.business_memberships;
create policy "Public can read demo memberships"
on public.business_memberships for select
to anon, authenticated
using (true);

drop policy if exists "Public can read demo customers" on public.customer_profiles;
create policy "Public can read demo customers"
on public.customer_profiles for select
to anon, authenticated
using (true);

drop policy if exists "Public can read demo stamp cards" on public.stamp_cards;
create policy "Public can read demo stamp cards"
on public.stamp_cards for select
to anon, authenticated
using (true);

drop policy if exists "Public can read demo customer missions" on public.customer_missions;
create policy "Public can read demo customer missions"
on public.customer_missions for select
to anon, authenticated
using (true);

drop policy if exists "Public can read demo loyalty events" on public.loyalty_events;
create policy "Public can read demo loyalty events"
on public.loyalty_events for select
to anon, authenticated
using (true);

drop policy if exists "Demo can create customer profiles" on public.customer_profiles;
create policy "Demo can create customer profiles"
on public.customer_profiles for insert
to anon, authenticated
with check (true);

drop policy if exists "Demo can create memberships" on public.business_memberships;
create policy "Demo can create memberships"
on public.business_memberships for insert
to anon, authenticated
with check (true);

drop policy if exists "Demo can update memberships" on public.business_memberships;
create policy "Demo can update memberships"
on public.business_memberships for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Demo can create rewards" on public.rewards;
create policy "Demo can create rewards"
on public.rewards for insert
to anon, authenticated
with check (true);

drop policy if exists "Demo can create missions" on public.missions;
create policy "Demo can create missions"
on public.missions for insert
to anon, authenticated
with check (true);

drop policy if exists "Demo can update missions" on public.missions;
create policy "Demo can update missions"
on public.missions for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Demo can delete missions" on public.missions;
create policy "Demo can delete missions"
on public.missions for delete
to anon, authenticated
using (true);

drop policy if exists "Demo can create campaigns" on public.campaigns;
create policy "Demo can create campaigns"
on public.campaigns for insert
to anon, authenticated
with check (true);

drop policy if exists "Demo can update campaigns" on public.campaigns;
create policy "Demo can update campaigns"
on public.campaigns for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Demo can delete campaigns" on public.campaigns;
create policy "Demo can delete campaigns"
on public.campaigns for delete
to anon, authenticated
using (true);

drop policy if exists "Demo can create campaign redemptions" on public.campaign_redemptions;
create policy "Demo can create campaign redemptions"
on public.campaign_redemptions for insert
to anon, authenticated
with check (true);

drop policy if exists "Demo can create stamp cards" on public.stamp_cards;
create policy "Demo can create stamp cards"
on public.stamp_cards for insert
to anon, authenticated
with check (true);

drop policy if exists "Demo can update stamp cards" on public.stamp_cards;
create policy "Demo can update stamp cards"
on public.stamp_cards for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Demo can create loyalty events" on public.loyalty_events;
create policy "Demo can create loyalty events"
on public.loyalty_events for insert
to anon, authenticated
with check (true);

drop policy if exists "Demo can read claim requests" on public.claim_requests;
create policy "Demo can read claim requests"
on public.claim_requests for select
to anon, authenticated
using (true);

drop policy if exists "Demo can create claim requests" on public.claim_requests;
create policy "Demo can create claim requests"
on public.claim_requests for insert
to anon, authenticated
with check (true);

drop policy if exists "Demo can update claim requests" on public.claim_requests;
create policy "Demo can update claim requests"
on public.claim_requests for update
to anon, authenticated
using (true)
with check (true);
