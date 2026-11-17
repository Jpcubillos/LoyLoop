"""Keep database FK actions consistent with Django and historical Supabase SQL."""
from django.db import migrations, models


def reconcile(apps, editor, reverse=False):
    q=editor.quote_name
    with editor.connection.cursor() as cursor:
        for model in apps.get_app_config('loyalty').get_models():
            if not model._meta.managed:
                continue
            for field in model._meta.local_fields:
                if not field.is_relation or not field.db_constraint:
                    continue
                action={models.CASCADE:'CASCADE',models.SET_NULL:'SET NULL',models.PROTECT:'NO ACTION'}[field.remote_field.on_delete]
                if reverse:
                    action='NO ACTION'
                cursor.execute('''SELECT c.conname FROM pg_constraint c
                    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
                    WHERE c.conrelid=to_regclass(%s) AND c.contype='f'
                    AND cardinality(c.conkey)=1 AND a.attname=%s''',
                    ['public.'+model._meta.db_table,field.column])
                rows=cursor.fetchall()
                if len(rows)!=1:
                    raise RuntimeError('A business foreign key requires schema review.')
                name=rows[0][0]
                target=field.remote_field.model._meta.db_table
                target=target if target.startswith('"auth".') else 'public.'+q(target)
                table='public.'+q(model._meta.db_table)
                cursor.execute(f'ALTER TABLE {table} DROP CONSTRAINT {q(name)}')
                cursor.execute(f'ALTER TABLE {table} ADD CONSTRAINT {q(name)} FOREIGN KEY ({q(field.column)}) REFERENCES {target} ({q(field.target_field.column)}) ON DELETE {action} DEFERRABLE INITIALLY DEFERRED')


def backwards(apps,editor):
    reconcile(apps,editor,reverse=True)


class Migration(migrations.Migration):
    dependencies=[('loyalty','0006_business_database_defaults')]
    operations=[migrations.RunPython(reconcile,backwards)]
