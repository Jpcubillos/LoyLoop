insert into public.businesses (slug, name, category, description, address, city, vip_purchase_threshold, at_risk_days, inactive_days)
values
  ('cafe-central', 'Cafe Central', 'Cafeteria', 'Cafe de barrio con recompensas, sellos y pagos MiniPay.', 'Cra. 7 #45-12', 'Bogota', 30, 90, 180),
  ('barberia-norte', 'Barberia Norte', 'Barberia', 'Cortes, barba y membresias para clientes frecuentes.', 'Calle 80 #12-30', 'Bogota', 20, 75, 150),
  ('green-wash', 'Green Wash', 'Lavadero', 'Lavado de carros y motos con puntos dobles en horas valle.', 'Av. 19 #104-22', 'Bogota', 15, 60, 120)
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  address = excluded.address,
  city = excluded.city,
  vip_purchase_threshold = excluded.vip_purchase_threshold,
  at_risk_days = excluded.at_risk_days,
  inactive_days = excluded.inactive_days;

insert into public.customer_profiles (full_name, phone, email, wallet_address)
values
  ('Juan Perez', '+573001234567', 'juan@loyloop.app', null),
  ('Maria Gonzalez', '+573002223333', 'maria@loyloop.app', null),
  ('Carlos Ruiz', '+573004445555', 'carlos@loyloop.app', null),
  ('Cliente Inactivo', '+573005551111', 'cliente.inactivo@loyloop.app', null),
  ('Cliente En Riesgo', '+573005552222', 'cliente.riesgo@loyloop.app', null),
  ('Cliente Activo', '+573005553333', 'cliente.activo@loyloop.app', null),
  ('Cliente VIP', '+573005554444', 'cliente.vip@loyloop.app', null)
on conflict (email) do update set
  full_name = excluded.full_name,
  phone = excluded.phone;

with cafe as (
  select id from public.businesses where slug = 'cafe-central'
),
juan as (
  select id from public.customer_profiles where email = 'juan@loyloop.app'
),
inactive_customer as (
  select id from public.customer_profiles where email = 'cliente.inactivo@loyloop.app'
),
risk_customer as (
  select id from public.customer_profiles where email = 'cliente.riesgo@loyloop.app'
),
active_customer as (
  select id from public.customer_profiles where email = 'cliente.activo@loyloop.app'
),
vip_customer as (
  select id from public.customer_profiles where email = 'cliente.vip@loyloop.app'
)
insert into public.app_users (email, full_name, account_type, business_id, customer_id, business_role, customer_segment, active)
select 'owner@loyloop.app', 'Dueños Cafe Central', 'business', cafe.id, null::uuid, 'owner', null::text, true from cafe
union all
select 'manager@loyloop.app', 'Administrador Cafe Central', 'business', cafe.id, null::uuid, 'manager', null::text, true from cafe
union all
select 'cajero@loyloop.app', 'Cajero Cafe Central', 'business', cafe.id, null::uuid, 'cashier', null::text, true from cafe
union all
select 'juan@loyloop.app', 'Juan Perez', 'customer', cafe.id, juan.id, null::text, null::text, true from cafe, juan
union all
select 'cliente.inactivo@loyloop.app', 'Cliente Inactivo', 'customer', cafe.id, inactive_customer.id, null::text, null::text, true from cafe, inactive_customer
union all
select 'cliente.riesgo@loyloop.app', 'Cliente En Riesgo', 'customer', cafe.id, risk_customer.id, null::text, null::text, true from cafe, risk_customer
union all
select 'cliente.activo@loyloop.app', 'Cliente Activo', 'customer', cafe.id, active_customer.id, null::text, null::text, true from cafe, active_customer
union all
select 'cliente.vip@loyloop.app', 'Cliente VIP', 'customer', cafe.id, vip_customer.id, null::text, null::text, true from cafe, vip_customer
on conflict (email) do update set
  full_name = excluded.full_name,
  account_type = excluded.account_type,
  business_id = excluded.business_id,
  customer_id = excluded.customer_id,
  business_role = excluded.business_role,
  customer_segment = excluded.customer_segment,
  active = excluded.active;

with cafe as (
  select id from public.businesses where slug = 'cafe-central'
),
barber as (
  select id from public.businesses where slug = 'barberia-norte'
),
wash as (
  select id from public.businesses where slug = 'green-wash'
),
juan as (
  select id from public.customer_profiles where email = 'juan@loyloop.app'
)
insert into public.business_memberships (business_id, customer_id, points_balance, credit_balance_cents, tier)
select cafe.id, juan.id, 120, 500000, 'Cliente frecuente' from cafe, juan
union all
select barber.id, juan.id, 80, 0, 'Activo' from barber, juan
union all
select wash.id, juan.id, 45, 0, 'Nuevo' from wash, juan
on conflict (business_id, customer_id) do update set
  points_balance = excluded.points_balance,
  credit_balance_cents = excluded.credit_balance_cents,
  tier = excluded.tier;

with cafe as (select id from public.businesses where slug = 'cafe-central')
delete from public.rewards
where business_id in (select id from cafe)
  and name in ('Cafe gratis con 10 sellos', '15% de descuento', '$5.000 de credito');

with cafe as (select id from public.businesses where slug = 'cafe-central')
insert into public.rewards (business_id, name, type, description, points_required, credit_amount_cents, audience_segment, active)
select id, 'Cafe gratis con 10 sellos', 'product', 'Completa 10 compras registradas y reclama un cafe gratis.', null::integer, null::integer, 'active', true from cafe
union all
select id, '15% de descuento', 'discount', 'Disponible en tu proxima visita.', 200, null::integer, 'active', true from cafe
union all
select id, '$5.000 de credito', 'credit', 'Credito de bienvenida para nuevos clientes.', null::integer, 500000, 'inactive', true from cafe;

with cafe as (select id from public.businesses where slug = 'cafe-central')
delete from public.missions
where business_id in (select id from cafe)
  and name in ('Compra 2 veces esta semana', 'Invita a un amigo', 'Paga con MiniPay');

with cafe as (select id from public.businesses where slug = 'cafe-central')
insert into public.missions (business_id, name, category, description, goal, reward_points, audience_segment, duration_type, starts_at, ends_at, active)
select id, 'Compra 2 veces esta semana', 'frequency', 'Realiza dos compras antes del domingo.', 2, 50, 'active', 'indefinite', null::timestamptz, null::timestamptz, true from cafe
union all
select id, 'Invita a un amigo', 'referral', 'Comparte tu enlace y suma un nuevo cliente.', 1, 40, 'vip', 'indefinite', null::timestamptz, null::timestamptz, true from cafe
union all
select id, 'Paga con MiniPay', 'minipay', 'Usa MiniPay en tu proxima compra.', 1, 30, 'active', 'one_hour', now(), now() + interval '1 hour', true from cafe;

with cafe as (select id from public.businesses where slug = 'cafe-central')
delete from public.campaigns
where business_id in (select id from cafe)
  and name in ('15% de descuento', 'Puntos dobles', 'Happy hour de cafe');

with cafe as (select id from public.businesses where slug = 'cafe-central')
insert into public.campaigns (business_id, name, type, description, discount_percent, reward_points, audience_segment, duration_type, status, starts_at, ends_at, active)
select id, '15% de descuento', 'discount_redeem', 'Disponible en tu proxima visita.', 15, 0, 'active', 'indefinite', 'active', null::timestamptz, null::timestamptz, true from cafe
union all
select id, 'Puntos dobles', 'points_boost', 'Valido por una hora desde que se activa.', null::integer, 20, 'active', 'one_hour', 'active', now(), now() + interval '1 hour', true from cafe
union all
select id, 'Happy hour de cafe', 'discount_redeem', '10% de descuento en bebidas despues de las 4 p.m.', 10, 0, 'vip', 'custom', 'scheduled', now() + interval '1 day', now() + interval '1 day 2 hours', true from cafe;

with cafe as (select id from public.businesses where slug = 'cafe-central'),
juan as (select id from public.customer_profiles where email = 'juan@loyloop.app')
insert into public.stamp_cards (business_id, customer_id, reward_name, current_stamps, required_stamps, active)
select cafe.id, juan.id, 'Cafe gratis con 10 sellos', 6, 10, true from cafe, juan
on conflict (business_id, customer_id, reward_name) do update set
  current_stamps = excluded.current_stamps,
  required_stamps = excluded.required_stamps,
  active = excluded.active;

with cafe as (select id from public.businesses where slug = 'cafe-central'),
juan as (select id from public.customer_profiles where email = 'juan@loyloop.app')
delete from public.loyalty_events
where business_id in (select id from cafe)
  and customer_id in (select id from juan)
  and event_type in ('join', 'credit_grant', 'purchase');

with cafe as (select id from public.businesses where slug = 'cafe-central'),
juan as (select id from public.customer_profiles where email = 'juan@loyloop.app')
insert into public.loyalty_events (business_id, customer_id, event_type, points_delta, credit_delta_cents, metadata)
select cafe.id, juan.id, 'join', 20, 0, '{"label":"Te uniste al club"}'::jsonb from cafe, juan
union all
select cafe.id, juan.id, 'credit_grant', 0, 500000, '{"label":"Credito de bienvenida"}'::jsonb from cafe, juan
union all
select cafe.id, juan.id, 'purchase', 15, 0, '{"label":"Compra registrada"}'::jsonb from cafe, juan;
