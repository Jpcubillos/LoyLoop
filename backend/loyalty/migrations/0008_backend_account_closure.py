"""Django-owned account closure; execution is never granted to API clients."""
from django.db import migrations

SQL="""
CREATE OR REPLACE FUNCTION public.loyloop_confirmed_auth_user(p_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE WHEN count(*)=1 THEN (array_agg(id))[1] ELSE NULL::uuid END
  FROM (SELECT id FROM auth.users WHERE lower(btrim(email))=lower(btrim(p_email))
    AND email_confirmed_at IS NOT NULL LIMIT 2) confirmed;
$$;
CREATE OR REPLACE FUNCTION public.check_loyloop_account_deletion()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_id uuid := auth.uid();
BEGIN
  IF current_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM 1 FROM auth.users WHERE id=current_id AND email_confirmed_at IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Confirmed account required'; END IF;
  IF EXISTS(SELECT 1 FROM public.businesses WHERE owner_user_id=current_id) THEN
    RAISE EXCEPTION 'Transfer or close the business first';
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.delete_loyloop_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_id uuid := auth.uid(); own_customer uuid;
BEGIN
  PERFORM public.check_loyloop_account_deletion();
  SELECT customer_id INTO own_customer FROM public.customer_identities
    WHERE auth_user_id=current_id FOR UPDATE;
  IF own_customer IS NOT NULL THEN
    DELETE FROM public.customer_profiles WHERE id=own_customer;
  END IF;
  DELETE FROM auth.users WHERE id=current_id;
END;
$$;
REVOKE ALL ON FUNCTION public.check_loyloop_account_deletion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_loyloop_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.loyloop_confirmed_auth_user(text) FROM PUBLIC;
"""


def permissions(apps,editor):
    with editor.connection.cursor() as cursor:
        for role in ['anon','authenticated']:
            cursor.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',[role])
            if cursor.fetchone():
                for name in ['check_loyloop_account_deletion','delete_loyloop_account']:
                    cursor.execute('REVOKE ALL ON FUNCTION public.'+name+'() FROM '+editor.quote_name(role))
                cursor.execute('REVOKE ALL ON FUNCTION public.loyloop_confirmed_auth_user(text) FROM '+editor.quote_name(role))
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname='loyloop_backend'")
        if cursor.fetchone():
            cursor.execute('GRANT EXECUTE ON FUNCTION public.check_loyloop_account_deletion(), public.delete_loyloop_account() TO loyloop_backend')
            cursor.execute('GRANT EXECUTE ON FUNCTION public.loyloop_confirmed_auth_user(text) TO loyloop_backend')


class Migration(migrations.Migration):
    dependencies=[('loyalty','0002_client_write_boundary')]
    operations=[migrations.RunSQL(SQL,reverse_sql='DROP FUNCTION public.delete_loyloop_account(); DROP FUNCTION public.check_loyloop_account_deletion(); DROP FUNCTION public.loyloop_confirmed_auth_user(text);'),
        migrations.RunPython(permissions,migrations.RunPython.noop)]
