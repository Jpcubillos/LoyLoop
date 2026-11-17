"""Read-only connectivity probe; no schema changes or personal data output."""
import os
import logging
from pathlib import Path
import secrets
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.postgres")
# Probe-only temporary key; never used by the web server.
os.environ.setdefault("DJANGO_SECRET_KEY", secrets.token_urlsafe(64))

import django
from django.db import connection

logging.getLogger("psycopg.pool").setLevel(logging.CRITICAL)

try:
    django.setup()
    with connection.cursor() as cursor:
        cursor.execute("BEGIN READ ONLY")
        cursor.execute("SELECT 1")
        assert cursor.fetchone() == (1,)
        # Supavisor terminates the client's TLS connection. pg_stat_ssl describes
        # its separate server connection, not this client-to-pooler channel.
        if not connection.connection.pgconn.ssl_in_use:
            raise RuntimeError("TLS required")
        cursor.execute("ROLLBACK")
    print("PostgreSQL: connected; TLS active; read-only probe passed.")
except Exception as exc:
    # Driver diagnostics can contain usernames or connection parameters.
    print("PostgreSQL probe failed (" + type(exc).__name__ + "). Check configuration/network/TLS privately.")
    sys.exit(1)
finally:
    connection.close()
    if hasattr(connection, "close_pool"):
        connection.close_pool()
