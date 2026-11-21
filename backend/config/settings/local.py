"""Local development only. No production data or credentials by default."""
from .base import *  # noqa: F403

DEBUG = env_bool("DJANGO_DEBUG", True)  # noqa: F405
ALLOWED_HOSTS = hosts()  # noqa: F405
CORS_ALLOWED_ORIGINS = cors_origins()  # noqa: F405
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}  # noqa: F405
SECURE_PROXY_SSL_HEADER = None
INSTALLED_APPS = list(INSTALLED_APPS) + ["loyalty"]  # noqa: F405
