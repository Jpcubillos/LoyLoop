"""Read-only column drift preflight. Does not authorize adoption or fake migrations."""
import os
from pathlib import Path
import secrets
import sys
import logging

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.postgres')
os.environ.setdefault('DJANGO_SECRET_KEY', secrets.token_urlsafe(64))
logging.getLogger('psycopg.pool').setLevel(logging.CRITICAL)

import django
django.setup()
from django.apps import apps
from django.db import connection

try:
    missing = extra = 0
    with connection.cursor() as cursor:
        cursor.execute('BEGIN READ ONLY')
        for model in apps.get_app_config('loyalty').get_models():
            if not model._meta.managed:
                continue
            cursor.execute('SELECT column_name FROM information_schema.columns WHERE table_schema=%s AND table_name=%s', ['public', model._meta.db_table])
            actual = {row[0] for row in cursor.fetchall()}
            expected = {field.column for field in model._meta.local_fields}
            missing += len(expected - actual)
            extra += len(actual - expected)
            print(model._meta.db_table + ': missing_columns=' + str(len(expected - actual)) + ', extra_columns=' + str(len(actual - expected)))
        cursor.execute('ROLLBACK')
    print('Column preflight only: types, defaults, constraints, triggers, RPCs and grants still require review.')
    sys.exit(1 if missing or extra else 0)
except Exception as exc:
    print('Schema probe failed (' + type(exc).__name__ + '). No database changes applied.')
    sys.exit(1)
finally:
    connection.close()
    connection.close_pool()
