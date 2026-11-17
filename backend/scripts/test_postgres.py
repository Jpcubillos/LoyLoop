"""Destructive migration/load checks restricted to the isolated CI database."""
import os
from pathlib import Path
import secrets
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.postgres_ci'
os.environ.setdefault('DJANGO_SECRET_KEY', secrets.token_urlsafe(64))

import django
django.setup()

from django.core.management import call_command
from django.db import connection, connections, transaction, IntegrityError, DatabaseError
from loyalty.models import Business, CustomerProfile, BusinessMembership, CustomerIdentity

assert connection.settings_dict['NAME'] == 'loyloop_ll235'
assert connection.settings_dict['HOST'] == '127.0.0.1'
with connection.cursor() as cursor:
    cursor.execute('CREATE SCHEMA IF NOT EXISTS auth')
    cursor.execute('CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY)')
    cursor.execute('ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email text')
    cursor.execute('ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz')
    cursor.execute("CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$")
    for role in ('anon', 'authenticated'):
        cursor.execute('SELECT 1 FROM pg_roles WHERE rolname=%s', [role])
        if not cursor.fetchone():
            cursor.execute(f'CREATE ROLE {role} NOLOGIN')
    cursor.execute('GRANT USAGE ON SCHEMA public TO anon, authenticated')

# Only a clean database is accepted by 0001; subsequent runs must already have
# reverted successfully or use a newly provisioned isolated container.
call_command('migrate', verbosity=0, interactive=False)
call_command('makemigrations', 'loyalty', check=True, dry_run=True, verbosity=0)
business = Business.objects.create(slug='integration', name='Test', category='Test')
customer = CustomerProfile.objects.create(full_name='Isolated fixture')
membership = BusinessMembership.objects.create(business=business, customer=customer)

# Database defaults and raw FK cascades are owned by Django migrations too.
with transaction.atomic():
    with connection.cursor() as cursor:
        cursor.execute("INSERT INTO businesses(slug,name,category) VALUES('raw-defaults','Fixture','Fixture') RETURNING id,created_at,vip_purchase_threshold")
        raw_id,created,threshold=cursor.fetchone()
        assert raw_id and created and threshold==30
        cursor.execute("INSERT INTO business_memberships(business_id,customer_id) VALUES(%s,%s) RETURNING id,points_balance",[raw_id,customer.id])
        raw_member,points=cursor.fetchone();assert points==0
        cursor.execute('DELETE FROM businesses WHERE id=%s',[raw_id])
        cursor.execute('SELECT count(*) FROM business_memberships WHERE id=%s',[raw_member])
        assert cursor.fetchone()[0]==0,'Raw SQL deletion did not cascade'

for attributes in ({'points_balance': -1}, {'credit_balance_cents': -1}, {}):
    try:
        with transaction.atomic():
            BusinessMembership.objects.create(business=business, customer=CustomerProfile.objects.create(full_name='Constraint fixture') if attributes else customer, **attributes)
    except IntegrityError:
        pass
    else:
        raise AssertionError('Expected uniqueness/nonnegative constraint rejection')

# The runtime role can operate managed data through RLS, without schema/Auth admin rights.
from loyalty.management.commands.provision_backend_role import grant_runtime_access
with connection.cursor() as cursor:
    cursor.execute("SELECT 1 FROM pg_roles WHERE rolname='loyloop_backend'")
    if not cursor.fetchone():cursor.execute('CREATE ROLE loyloop_backend NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS')
    grant_runtime_access(cursor)
with transaction.atomic(),connection.cursor() as cursor:
    cursor.execute('SET LOCAL ROLE loyloop_backend')
    cursor.execute('SELECT count(*) FROM businesses');assert cursor.fetchone()[0]>=1
    cursor.execute('UPDATE business_memberships SET points_balance=points_balance WHERE id=%s',[membership.id])
    cursor.execute("SELECT has_schema_privilege(current_user,'public','CREATE'),has_schema_privilege(current_user,'auth','USAGE')")
    assert cursor.fetchone()==(False,False)
    cursor.execute("SELECT public.loyloop_confirmed_auth_user('absent@example.invalid')");assert cursor.fetchone()[0] is None


for role in ('anon', 'authenticated'):
    for sql in ("INSERT INTO businesses(id,slug,name,category) VALUES(gen_random_uuid(),'forbidden','Test','Test')",
                "UPDATE business_memberships SET points_balance=999", 'DELETE FROM rewards'):
        try:
            with transaction.atomic(), connection.cursor() as cursor:
                cursor.execute(f'SET LOCAL ROLE {role}')
                cursor.execute(sql)
        except DatabaseError:
            pass
        else:
            raise AssertionError('Client write was not rejected')

def increment(_):
    try:
        with transaction.atomic():
            row = BusinessMembership.objects.select_for_update().get(pk=membership.pk)
            row.points_balance += 1
            row.save(update_fields=['points_balance'])
    finally:
        connections['default'].close()

with ThreadPoolExecutor(max_workers=8) as executor:
    list(executor.map(increment, range(60)))
membership.refresh_from_db()
assert membership.points_balance == 60, 'Lost concurrent updates'
stats = connection.pool.get_stats()
assert stats['pool_size'] <= 3
connection.close()
connection.close_pool()
with connection.cursor() as cursor:
    cursor.execute("SELECT count(*) FROM pg_stat_activity WHERE application_name='loyloop-ll235-isolated'")
    assert cursor.fetchone()[0] <= 3, 'Pool connections leaked'

# A new migration must not destroy business data when migrate is idempotently rerun.
call_command('migrate', verbosity=0, interactive=False)
assert BusinessMembership.objects.get(pk=membership.pk).points_balance == 60
call_command('migrate', 'loyalty', 'zero', verbosity=0, interactive=False)
assert 'businesses' not in connection.introspection.table_names()
call_command('migrate', 'loyalty', verbosity=0, interactive=False)
assert Business.objects.count() == 0
call_command('migrate', 'loyalty', 'zero', verbosity=0, interactive=False)
connection.close()
connection.close_pool()
with connection.cursor() as cursor:
    cursor.execute('DROP OWNED BY loyloop_backend')
    cursor.execute('DROP ROLE loyloop_backend')
print('PostgreSQL: migration apply/reverse/reapply, constraints, client writes, concurrency and bounded pool passed.')
