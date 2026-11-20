"""Cut writes only after the reviewed schema/API transition; retain legacy reads."""
from django.db import migrations


def secure_new_tables(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        raise RuntimeError('The business permission boundary requires PostgreSQL.')
    q=schema_editor.quote_name
    with schema_editor.connection.cursor() as cursor:
        roles=['PUBLIC']
        for role in ('anon','authenticated'):
            cursor.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',[role])
            if cursor.fetchone(): roles.append(role)
        for model in apps.get_app_config('loyalty').get_models():
            if not model._meta.managed: continue
            table='public.'+q(model._meta.db_table)
            columns=','.join(q(field.column) for field in model._meta.local_fields)
            cursor.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
            for role in roles:
                grantee='PUBLIC' if role=='PUBLIC' else q(role)
                cursor.execute(f'REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE {table} FROM {grantee}')
                cursor.execute(f'REVOKE INSERT ({columns}),UPDATE ({columns}),REFERENCES ({columns}) ON TABLE {table} FROM {grantee}')
            for role in roles[1:]:
                cursor.execute("SELECT has_table_privilege(%s,%s,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(%s,%s,'INSERT,UPDATE,REFERENCES')",[role,table,role,table])
                if cursor.fetchone()[0]:
                    raise RuntimeError('Inherited client write privileges require review.')
            if model._meta.db_table=='claim_requests':
                for role in roles:
                    grantee='PUBLIC' if role=='PUBLIC' else q(role)
                    cursor.execute(f'REVOKE SELECT ON TABLE {table} FROM {grantee}')
                    cursor.execute(f'REVOKE SELECT ({columns}) ON TABLE {table} FROM {grantee}')
                for role in roles[1:]:
                    cursor.execute("SELECT has_any_column_privilege(%s,%s,'SELECT')",[role,table])
                    if cursor.fetchone()[0]:
                        raise RuntimeError('Inherited claim-code visibility requires review.')
            if model._meta.db_table=='app_users':
                public_columns=','.join(q(field.column) for field in model._meta.local_fields if field.column!='auth_user_id')
                for role in roles:
                    cursor.execute("SELECT EXISTS(SELECT 1 FROM pg_class c, LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid=to_regclass(%s) AND a.privilege_type='SELECT' AND a.grantee=CASE WHEN %s='PUBLIC' THEN 0 ELSE (SELECT oid FROM pg_roles WHERE rolname=%s) END)",[table,role,role])
                    had_select=cursor.fetchone()[0]
                    grantee='PUBLIC' if role=='PUBLIC' else q(role)
                    cursor.execute(f'REVOKE SELECT ON TABLE {table} FROM {grantee}')
                    cursor.execute(f'REVOKE SELECT (auth_user_id) ON TABLE {table} FROM {grantee}')
                    if had_select:
                        cursor.execute(f'GRANT SELECT ({public_columns}) ON TABLE {table} TO {grantee}')
                for role in roles[1:]:
                    cursor.execute("SELECT has_column_privilege(%s,%s,'auth_user_id','SELECT')",[role,table])
                    if cursor.fetchone()[0]:
                        raise RuntimeError('Inherited Auth binding visibility requires review.')
        # A legacy SECURITY DEFINER RPC must not bypass the new table boundary.
        readonly={'check_loyloop_account_deletion','loyloop_mobile_profile_ready'}
        cursor.execute("SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef")
        for oid,name,args in cursor.fetchall():
            if name in readonly: continue
            routine='public.'+q(name)+'('+args+')'
            for role in roles:
                grantee='PUBLIC' if role=='PUBLIC' else q(role)
                cursor.execute(f'REVOKE EXECUTE ON FUNCTION {routine} FROM {grantee}')
            for role in roles[1:]:
                cursor.execute("SELECT has_function_privilege(%s,%s,'EXECUTE')",[role,oid])
                if cursor.fetchone()[0]:
                    raise RuntimeError('Inherited client RPC execution requires review.')


class Migration(migrations.Migration):
    dependencies=[('loyalty','0007_database_delete_actions')]
    operations=[migrations.RunPython(secure_new_tables,migrations.RunPython.noop)]
