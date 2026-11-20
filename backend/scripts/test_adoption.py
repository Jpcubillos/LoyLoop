"""Validate migration adoption against the authorized no-network restored copy."""
import os
from pathlib import Path
import secrets
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
staging=os.environ.get('LL235_STAGING_REHEARSAL')=='yes'
os.environ['DJANGO_SETTINGS_MODULE']='config.settings.staging' if staging else 'config.settings.restore_ci'
os.environ['LL235_ADOPT_EXISTING']='yes'
os.environ.setdefault('DJANGO_SECRET_KEY',secrets.token_urlsafe(64))

import django
django.setup()
from django.core.management import call_command
from django.core.management.base import CommandError
from django.core.exceptions import ImproperlyConfigured
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


def fingerprint(table,columns):
    q=connection.ops.quote_name
    projection=','.join(q(name) for name in columns)
    query=f"SELECT encode(sha256(convert_to(coalesce(string_agg(h, '' ORDER BY h), ''),'UTF8')),'hex') FROM (SELECT encode(sha256(convert_to(row_to_json(t)::text,'UTF8')),'hex') h FROM (SELECT {projection} FROM public.{q(table)}) t) fingerprints"
    with connection.cursor() as cursor:
        cursor.execute(query)
        return cursor.fetchone()[0]


def main():
    from loyalty.migration_ops_v1 import TABLES
    if connection.settings_dict['NAME']!='loyloop_restore' or connection.settings_dict['HOST']!=('/run/pgsocket' if staging else '127.0.0.1'):
        raise RuntimeError('Only the isolated restored database is permitted.')
    before={}
    with connection.cursor() as cursor:
        for table in sorted(TABLES):
            cursor.execute('SELECT column_name FROM information_schema.columns WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position',['public',table])
            columns=[row[0] for row in cursor.fetchall()]
            if columns:
                before[table]=(columns,fingerprint(table,columns))
    # Adopt schema without client permission cutover yet.
    call_command('migrate','loyalty','0007',verbosity=0,interactive=False)
    for table,(columns,expected) in before.items():
        if fingerprint(table,columns)!=expected:
            raise RuntimeError('Legacy business values changed during schema adoption.')
    # Seed old direct grants as a positive control: restore intentionally omitted ACLs.
    with connection.cursor() as cursor:
        cursor.execute('GRANT USAGE ON SCHEMA public TO anon,authenticated')
        cursor.execute('GRANT SELECT,INSERT,UPDATE,DELETE ON public.business_memberships TO anon,authenticated')
        cursor.execute('GRANT UPDATE (points_balance) ON public.business_memberships TO anon,authenticated')
        cursor.execute('GRANT SELECT ON public.app_users TO anon,authenticated')
        cursor.execute('CREATE FUNCTION public.ll235_regression_write() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ UPDATE public.business_memberships SET points_balance=points_balance WHERE false $$')
        cursor.execute('GRANT EXECUTE ON FUNCTION public.ll235_regression_write() TO PUBLIC')
        cursor.execute('BEGIN')
        cursor.execute('SET LOCAL ROLE anon')
        cursor.execute('UPDATE public.business_memberships SET points_balance=points_balance WHERE false')
        cursor.execute('SELECT public.ll235_regression_write()')
        cursor.execute('ROLLBACK')
    call_command('migrate',verbosity=0,interactive=False)
    from django.db import transaction,DatabaseError
    for role in ('anon','authenticated'):
        try:
            with transaction.atomic(),connection.cursor() as cursor:
                cursor.execute('SET LOCAL ROLE '+role)
                cursor.execute('UPDATE public.business_memberships SET points_balance=points_balance WHERE false')
        except DatabaseError:
            pass
        else:
            raise RuntimeError('Legacy direct write was not blocked by the cutover migration.')
    for role in ('anon','authenticated'):
        with connection.cursor() as cursor:
            cursor.execute("SELECT has_column_privilege(%s,'public.app_users','email','SELECT'),has_column_privilege(%s,'public.app_users','auth_user_id','SELECT')",[role,role])
            assert cursor.fetchone()==(True,False),'Legacy read or Auth UUID visibility changed'
        try:
            with transaction.atomic(),connection.cursor() as cursor:
                cursor.execute('SET LOCAL ROLE '+role)
                cursor.execute('SELECT public.ll235_regression_write()')
        except DatabaseError:
            pass
        else:
            raise RuntimeError('Legacy SECURITY DEFINER write bypass remains available')
    # A destructive rollback must stop before dropping any adopted data.
    try:
        call_command('migrate','loyalty','zero',verbosity=0,interactive=False)
    except CommandError:
        pass
    else:
        raise RuntimeError('Destructive adopted-schema rollback was not rejected.')
    for table,(columns,expected) in before.items():
        if fingerprint(table,columns)!=expected:
            raise RuntimeError('Legacy values changed after permission/rollback checks.')
    executor=MigrationExecutor(connection)
    if executor.migration_plan(executor.loader.graph.leaf_nodes()):
        raise RuntimeError('Migrations remain pending after isolated adoption.')
    with connection.cursor() as cursor:
        cursor.execute('DROP FUNCTION public.ll235_regression_write()')
    print('Restored-copy adoption: legacy business values preserved by SHA256, stable Auth bindings applied, direct writes blocked, unsafe rollback rejected, no pending migrations.')


if __name__=='__main__':
    try:
        main()
    except ImproperlyConfigured as exc:
        print('Adoption configuration check failed:',str(exc))
        raise SystemExit(1) from None
    except Exception as exc:
        name=getattr(getattr(exc,'__cause__',None),'diag',None)
        print('Isolated adoption failed:',type(exc).__name__)
        if name and getattr(name,'constraint_name',None):
            print('Related constraint:',name.constraint_name)
        raise SystemExit(1) from None
    finally:
        connection.close()
        connection.close_pool()
