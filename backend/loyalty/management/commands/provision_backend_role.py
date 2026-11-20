"""Separate API runtime access from the migration owner's credentials."""
from pathlib import Path
import secrets
from django.conf import settings
from django.core.management.base import BaseCommand,CommandError
from django.db import connection,transaction
from django.test.utils import override_settings
from dotenv import dotenv_values
from psycopg import sql
from loyalty.migration_ops_v1 import TABLES

ROLE='loyloop_backend'


def grant_runtime_access(cursor):
    cursor.execute('GRANT CONNECT ON DATABASE '+connection.ops.quote_name(connection.settings_dict['NAME'])+' TO '+ROLE)
    cursor.execute('GRANT USAGE ON SCHEMA public TO '+ROLE)
    existing=set(connection.introspection.table_names(cursor))
    for name in sorted(TABLES & existing):
        table='public.'+connection.ops.quote_name(name)
        readonly=name=='platform_business_approvers'
        cursor.execute('GRANT '+('SELECT' if readonly else 'SELECT,INSERT,UPDATE,DELETE')+' ON '+table+' TO '+ROLE)
        cursor.execute('ALTER TABLE '+table+' ENABLE ROW LEVEL SECURITY')
        cursor.execute('DROP POLICY IF EXISTS loyloop_django_runtime ON '+table)
        cursor.execute('CREATE POLICY loyloop_django_runtime ON '+table+' FOR '+('SELECT' if readonly else 'ALL')+' TO '+ROLE+' USING (true)'+('' if readonly else ' WITH CHECK (true)'))
    if 'django_migrations' in existing:
        cursor.execute('GRANT SELECT ON public.django_migrations TO '+ROLE)
        cursor.execute('DROP POLICY IF EXISTS loyloop_django_runtime ON public.django_migrations')
        cursor.execute('CREATE POLICY loyloop_django_runtime ON public.django_migrations FOR SELECT TO '+ROLE+' USING (true)')
    for function in ['check_loyloop_account_deletion','delete_loyloop_account']:
        cursor.execute('SELECT to_regprocedure(%s)',['public.'+function+'()'])
        if cursor.fetchone()[0]:
            cursor.execute('GRANT EXECUTE ON FUNCTION public.'+function+'() TO '+ROLE)
    cursor.execute("SELECT to_regprocedure('public.loyloop_confirmed_auth_user(text)')")
    if cursor.fetchone()[0]:
        cursor.execute('GRANT EXECUTE ON FUNCTION public.loyloop_confirmed_auth_user(text) TO '+ROLE)
    cursor.execute("SELECT has_schema_privilege(%s,'public','CREATE'),has_table_privilege(%s,'auth.users','SELECT')",[ROLE,ROLE])
    if cursor.fetchone()!=(False,False):
        raise RuntimeError('Inherited schema/Auth privileges require review.')


class Command(BaseCommand):
    help='Provision the fixed backend role and save its credentials only in ignored private runtime storage.'
    def add_arguments(self,parser):
        parser.add_argument('--apply',required=True,action='store_true')

    def handle(self,*args,**options):
        cfg=connection.settings_dict
        if cfg['HOST']!='aws-1-us-east-2.pooler.supabase.com' or cfg['USER']!='postgres.phvuowulzkrttgcfnvly' or cfg['OPTIONS'].get('sslmode')!='verify-full':
            raise CommandError('Only the reviewed migration-owner connection with verified TLS is accepted.')
        root=Path(settings.BASE_DIR)
        target=root/'.docker/runtime.env'
        source=dotenv_values(root/'.env',interpolate=False)
        if target.exists():
            runtime=dotenv_values(target,interpolate=False)
            if runtime.get('DB_USER')!=ROLE+'.phvuowulzkrttgcfnvly' or not runtime.get('DB_PASSWORD'):
                raise CommandError('The existing runtime file requires review; it will not be overwritten.')
            password=runtime['DB_PASSWORD']
        else:
            runtime={k:v for k,v in source.items() if v is not None}
            password=secrets.token_urlsafe(48)
        runtime.update(DB_USER=ROLE+'.phvuowulzkrttgcfnvly',DB_PASSWORD=password)
        target.parent.mkdir(exist_ok=True)
        pending=target.with_name('runtime.env.pending')
        if pending.exists():
            raise CommandError('An unfinished private runtime file requires review.')
        from dotenv import set_key
        try:
            with override_settings(DEBUG=False),transaction.atomic(),connection.cursor() as cursor:
                cursor.execute('SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=%s',[ROLE])
                existing=cursor.fetchone()
                if existing:
                    if not target.exists() or existing!=(True,False,False,False,False):
                        raise RuntimeError('Existing database role requires review.')
                    cursor.execute('SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=%s)',[ROLE])
                    if cursor.fetchone():raise RuntimeError('Inherited role membership requires review.')
                else:
                    if target.exists():raise RuntimeError('Runtime file exists but its database role is absent.')
                    cursor.execute(sql.SQL('CREATE ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS CONNECTION LIMIT 12 PASSWORD {}').format(sql.Identifier(ROLE),sql.Literal(password)))
                grant_runtime_access(cursor)
                pending.touch(mode=0o600)
                for key,value in runtime.items():set_key(pending,key,value,quote_mode='always')
                pending.chmod(0o600)
        except Exception as exc:
            if pending.exists():pending.unlink()
            raise CommandError('Backend role provisioning failed ('+type(exc).__name__+'). No secret was printed.') from None
        # Preserve arbitrary secrets without shell/Compose interpolation.
        pending.replace(target)
        target.chmod(0o600)
        self.stdout.write('Backend role provisioned: no superuser, DDL, role/database creation, RLS bypass or whole-Auth reads; identity lookup/closure use fixed backend-only functions. Private runtime file saved.')
