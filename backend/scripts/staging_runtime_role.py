"""Provision only the no-network staging role from the separate maintenance job."""
from pathlib import Path
from dotenv import dotenv_values
import django
django.setup()
from django.db import connection,transaction
from loyalty.management.commands.provision_backend_role import grant_runtime_access
from psycopg import sql
if connection.settings_dict['HOST']!='/run/pgsocket' or connection.settings_dict['USER']!='postgres':
    raise SystemExit('Only isolated staging maintenance is accepted.')
secret=dotenv_values(Path('/run/secrets/staging_runtime_env'),interpolate=False)
if secret.get('DB_USER')!='loyloop_backend' or len(secret.get('DB_PASSWORD',''))<32:
    raise SystemExit('The private runtime secret is required.')
with transaction.atomic(),connection.cursor() as cursor:
    cursor.execute("SELECT 1 FROM pg_roles WHERE rolname='loyloop_backend'")
    if not cursor.fetchone():cursor.execute('CREATE ROLE loyloop_backend LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS CONNECTION LIMIT 12')
    cursor.execute(sql.SQL('ALTER ROLE loyloop_backend PASSWORD {}').format(sql.Literal(secret['DB_PASSWORD'])))
    grant_runtime_access(cursor)
print('Isolated runtime role provisioned with the same business grants as Supabase runtime.')
