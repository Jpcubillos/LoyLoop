"""Deploy profile: environment variables only, verified TLS is mandatory."""
import os
from django.core.exceptions import ImproperlyConfigured
from .production import *  # noqa: F403
from config.database import postgres_database

if os.environ.get("DB_SSLMODE", "verify-full") != "verify-full":
    raise ImproperlyConfigured("Production PostgreSQL requires DB_SSLMODE=verify-full.")
DATABASES = {"default": postgres_database()}
if BUSINESS_API_ENABLED and DATABASES["default"]["USER"].split(".")[0]!="loyloop_backend":
    raise ImproperlyConfigured("The business API requires its separate least-privilege database role.")

# Supabase Auth owns identity. Do not create unused Django auth/session tables.
INSTALLED_APPS = ['corsheaders','rest_framework','loyalty']
MIDDLEWARE = [entry for entry in MIDDLEWARE if entry not in {
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
}]
REST_FRAMEWORK = {**REST_FRAMEWORK, 'UNAUTHENTICATED_USER': None}
