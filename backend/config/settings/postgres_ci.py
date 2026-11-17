"""Ephemeral loopback PostgreSQL only; never loads backend/.env."""
import os
from django.core.exceptions import ImproperlyConfigured
from .local import *  # noqa: F403

if os.environ.get("LL235_ISOLATED_DATABASE") != "yes":
    raise ImproperlyConfigured("LL235_ISOLATED_DATABASE=yes is required for database tests.")
if os.environ.get("DB_HOST", "127.0.0.1") not in {"127.0.0.1", "localhost"}:
    raise ImproperlyConfigured("Isolated database tests require loopback.")
DATABASES = {"default": {
    "ENGINE": "django.db.backends.postgresql", "HOST": "127.0.0.1",
    "PORT": os.environ.get("DB_PORT", "55435"), "NAME": "loyloop_ll235",
    "USER": "postgres", "PASSWORD": os.environ["DB_PASSWORD"],
    "CONN_MAX_AGE": 0, "DISABLE_SERVER_SIDE_CURSORS": True,
    "OPTIONS": {"sslmode": "disable", "prepare_threshold": None,
                "application_name": "loyloop-ll235-isolated",
                "pool": {"min_size": 0, "max_size": 3, "timeout": 10, "max_waiting": 20}},
}}

# Supabase Auth owns identity. Do not create unused Django auth/session tables.
INSTALLED_APPS = ['corsheaders','rest_framework','loyalty']
MIDDLEWARE = [entry for entry in MIDDLEWARE if entry not in {
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
}]
REST_FRAMEWORK = {**REST_FRAMEWORK, 'UNAUTHENTICATED_USER': None}
BUSINESS_API_ENABLED = True
