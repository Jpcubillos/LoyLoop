"""Explicit local PostgreSQL profile. Never run migrate against an unadopted database."""
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False, interpolate=False)

from .local import *  # noqa: E402,F403
from config.database import postgres_database  # noqa: E402

DATABASES = {"default": postgres_database()}

# Supabase Auth owns identity. Do not create unused Django auth/session tables.
INSTALLED_APPS = ['corsheaders','rest_framework','loyalty']
MIDDLEWARE = [entry for entry in MIDDLEWARE if entry not in {
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
}]
REST_FRAMEWORK = {**REST_FRAMEWORK, 'UNAUTHENTICATED_USER': None}
