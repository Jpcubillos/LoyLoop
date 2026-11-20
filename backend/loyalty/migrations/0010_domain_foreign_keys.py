"""Reconcile domain ON DELETE actions after 0009 foreign keys are installed.

In Django PostgreSQL, foreign key DDL for CreateModel may run at the end of
its migration's schema-editor context, so it is not yet available to RunPython
operations within that same migration.
"""
from django.db import migrations

# Only the new tables and expected foreign key relationships are modified.
DOMAIN_FKS = {
    'activity_receipts': {
        'business_id': ('businesses', 'CASCADE'),
        'customer_id': ('customer_profiles', 'CASCADE'),
        'event_id': ('loyalty_events', 'CASCADE'),
        'card_id': ('stamp_cards', 'SET NULL'),
    },
    'identity_challenges': {
        'business_id': ('businesses', 'CASCADE'),
        'customer_id': ('customer_profiles', 'CASCADE'),
    },
    'stamp_completions': {
        'card_id': ('stamp_cards', 'CASCADE'),
        'claim_id': ('claim_requests', 'CASCADE'),
    },
    'business_plan_assignments': {
        'business_id': ('businesses', 'CASCADE'),
    },
    'reward_redemptions': {
        'reward_id': ('rewards', 'CASCADE'),
        'claim_id': ('claim_requests', 'CASCADE'),
        'business_id': ('businesses', 'CASCADE'),
        'customer_id': ('customer_profiles', 'CASCADE'),
    },
}


def enforce_fk_deletes(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        raise RuntimeError('Domain migrations require PostgreSQL.')
    q = schema_editor.quote_name
    with schema_editor.connection.cursor() as cursor:
        for name, mapping in DOMAIN_FKS.items():
            for column, (target, action) in mapping.items():
                cursor.execute('''SELECT c.conname FROM pg_constraint c
                    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
                    WHERE c.conrelid=to_regclass(%s) AND c.contype='f'
                      AND c.confrelid=to_regclass(%s)
                      AND cardinality(c.conkey)=1 AND a.attname=%s''',
                    ['public.' + name, 'public.' + target, column])
                rows = cursor.fetchall()
                if len(rows) != 1:
                    raise RuntimeError(
                        f'Expected exactly one FK public.{name}.{column} -> '
                        f'public.{target}(id), found {len(rows)}. '
                        'Review the schema; no constraint was altered.'
                    )
                table = 'public.' + q(name)
                constraint_name = q(rows[0][0])
                cursor.execute('ALTER TABLE ' + table + ' DROP CONSTRAINT ' + constraint_name)
                cursor.execute('ALTER TABLE ' + table + ' ADD CONSTRAINT ' + constraint_name +
                    ' FOREIGN KEY (' + q(column) + ') REFERENCES public.' + q(target) +
                    ' (id) ON DELETE ' + action + ' DEFERRABLE INITIALLY DEFERRED')


class Migration(migrations.Migration):
    dependencies = [('loyalty', '0009_domain_services')]
    operations = [migrations.RunPython(enforce_fk_deletes, migrations.RunPython.noop)]
