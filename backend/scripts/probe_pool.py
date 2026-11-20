"""Small read-only concurrency probe of the configured PostgreSQL pool."""
from concurrent.futures import ThreadPoolExecutor
import logging
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.postgres')
logging.getLogger('psycopg.pool').setLevel(logging.CRITICAL)

import django
django.setup()
from django.db import connection, connections


def read_only_query(_):
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute('BEGIN READ ONLY')
            cursor.execute('SELECT 1')
            result = cursor.fetchone()
            cursor.execute('ROLLBACK')
            if result != (1,):
                raise RuntimeError('Unexpected probe response')
    finally:
        connections['default'].close()


try:
    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(read_only_query, range(60)))
    pool = connection.pool
    stats = pool.get_stats()
    maximum = connection.settings_dict['OPTIONS']['pool']['max_size']
    if stats['pool_size'] > maximum or stats['pool_available'] != stats['pool_size']:
        raise RuntimeError('Pool size or lease return check failed')
    connection.close()
    connection.close_pool()
    if not pool.closed:
        raise RuntimeError('Local pool did not close')
    print('Read-only pool probe: 60 successful queries, 8 threads, bounded pool, all leases returned and local pool closed.')
    print('This is a light connectivity probe, not a capacity benchmark. External pooler server sessions may remain pooled normally.')
except Exception as exc:
    print('Pool probe failed ('+type(exc).__name__+'); no data writes were requested.')
    raise SystemExit(1) from None
finally:
    connection.close()
    connection.close_pool()
