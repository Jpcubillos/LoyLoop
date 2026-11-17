"""Bind legacy records to confirmed Auth UUIDs without changing balances/roles."""
from django.db import migrations


def bind_verified_accounts(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        raise RuntimeError('Verified Auth adoption requires PostgreSQL.')
    with schema_editor.connection.cursor() as cursor:
        cursor.execute('''
            SELECT 1 FROM public.app_users
            GROUP BY lower(btrim(email)) HAVING count(*) > 1 LIMIT 1
        ''')
        if cursor.fetchone():
            raise RuntimeError('Resolve ambiguous legacy accounts before adoption.')
        cursor.execute('''
            SELECT 1 FROM auth.users
            WHERE email_confirmed_at IS NOT NULL AND email IS NOT NULL
            GROUP BY lower(btrim(email)) HAVING count(*) > 1 LIMIT 1
        ''')
        if cursor.fetchone():
            raise RuntimeError('Resolve ambiguous confirmed Auth identities before adoption.')
        cursor.execute('''
            SELECT 1 FROM public.app_users AS a JOIN auth.users AS u
              ON lower(btrim(a.email))=lower(btrim(u.email))
            WHERE u.email_confirmed_at IS NOT NULL
              AND a.auth_user_id IS NOT NULL AND a.auth_user_id<>u.id LIMIT 1
        ''')
        if cursor.fetchone():
            raise RuntimeError('Conflicting Auth bindings require review.')
        cursor.execute('''
            UPDATE public.app_users AS a SET auth_user_id=u.id
            FROM auth.users AS u
            WHERE lower(btrim(a.email))=lower(btrim(u.email))
              AND u.email_confirmed_at IS NOT NULL AND a.auth_user_id IS NULL
        ''')
        cursor.execute('''
            SELECT 1 FROM public.customer_profiles AS p
            JOIN auth.users AS u ON lower(btrim(p.email))=lower(btrim(u.email))
            JOIN public.customer_identities AS i ON (i.auth_user_id=u.id OR i.customer_id=p.id)
            WHERE u.email_confirmed_at IS NOT NULL
              AND (i.auth_user_id<>u.id OR i.customer_id<>p.id) LIMIT 1
        ''')
        if cursor.fetchone():
            raise RuntimeError('Conflicting customer identities require review.')
        cursor.execute('''
            INSERT INTO public.customer_identities(auth_user_id, customer_id, created_at)
            SELECT u.id,p.id,now() FROM public.customer_profiles AS p
            JOIN auth.users AS u ON lower(btrim(p.email))=lower(btrim(u.email))
            WHERE u.email_confirmed_at IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM public.customer_identities AS i WHERE i.auth_user_id=u.id)
        ''')
        # Also supports the outer transaction used by controlled adoption.
        cursor.execute('SET CONSTRAINTS ALL IMMEDIATE')


class Migration(migrations.Migration):
    dependencies = [('loyalty','0004_appuser_auth_user_alter_customerprofile_email_and_more')]
    # Reverting keeps verified bindings until the field/table itself is removed;
    # do not erase preexisting legitimate associations on an operational rollback.
    operations = [migrations.RunPython(bind_verified_accounts,migrations.RunPython.noop)]
