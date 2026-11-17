"""Explicit PostgreSQL configuration for Supavisor or a direct connection."""
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured


def postgres_database():
    required = ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD")
    if any(not os.environ.get(key, "").strip() for key in required):
        raise ImproperlyConfigured("DB_HOST, DB_NAME, DB_USER and DB_PASSWORD are required.")
    mode = os.environ.get("DB_POOL_MODE", "session")
    if mode not in {"direct", "session", "transaction"}:
        raise ImproperlyConfigured("DB_POOL_MODE must be direct, session or transaction.")
    sslmode = os.environ.get("DB_SSLMODE", "verify-full")
    if sslmode not in {"require", "verify-full"}:
        raise ImproperlyConfigured("DB_SSLMODE must be require or verify-full.")
    root = os.environ.get("DB_SSLROOTCERT", "")
    if sslmode == "verify-full" and (not root or not Path(root).is_file()):
        raise ImproperlyConfigured("DB_SSLROOTCERT must reference the trusted CA file for verify-full.")
    try:
        port = int(os.environ.get("DB_PORT", "5432"))
        maximum = int(os.environ.get("DB_POOL_MAX_SIZE", "5"))
        timeout = int(os.environ.get("DB_CONNECT_TIMEOUT", "10"))
    except ValueError:
        raise ImproperlyConfigured("Database port, pool size and timeout must be integers.") from None
    if not (1 <= port <= 65535 and 1 <= maximum <= 20 and 1 <= timeout <= 60):
        raise ImproperlyConfigured("Database port, pool size or timeout is outside supported limits.")
    options = {"sslmode": sslmode, "connect_timeout": timeout,
               "prepare_threshold": None,
               "pool": {"min_size": 0, "max_size": maximum, "timeout": timeout,
                        "max_waiting": maximum * 4},
               "application_name": "loyloop-django"}
    if root:
        options["sslrootcert"] = root
    return {"ENGINE": "django.db.backends.postgresql", "HOST": os.environ["DB_HOST"],
            "PORT": port, "NAME": os.environ["DB_NAME"], "USER": os.environ["DB_USER"],
            "PASSWORD": os.environ["DB_PASSWORD"], "CONN_MAX_AGE": 0,
            "CONN_HEALTH_CHECKS": True, "DISABLE_SERVER_SIDE_CURSORS": mode == "transaction",
            "OPTIONS": options}
