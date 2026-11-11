"""Production-like security; database integration belongs to LL-235."""
import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

if env_bool("DJANGO_DEBUG", False):  # noqa: F405
    raise ImproperlyConfigured("DJANGO_DEBUG must be false in production.")
DEBUG = False
ALLOWED_HOSTS = hosts(required=True)  # noqa: F405
CORS_ALLOWED_ORIGINS = cors_origins(production=True)  # noqa: F405
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)  # noqa: F405
if not SECURE_SSL_REDIRECT:
    raise ImproperlyConfigured("DJANGO_SECURE_SSL_REDIRECT must be true in production.")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
try:
    SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_SECURE_HSTS_SECONDS", "31536000"))
except ValueError as exc:
    raise ImproperlyConfigured("DJANGO_SECURE_HSTS_SECONDS must be an integer of at least 31536000.") from exc
if SECURE_HSTS_SECONDS < 31536000:
    raise ImproperlyConfigured("DJANGO_SECURE_HSTS_SECONDS must be at least 31536000 in production.")
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", False)  # noqa: F405
SECURE_HSTS_PRELOAD = env_bool("DJANGO_SECURE_HSTS_PRELOAD", False)  # noqa: F405
if SECURE_HSTS_PRELOAD and not SECURE_HSTS_INCLUDE_SUBDOMAINS:
    raise ImproperlyConfigured("DJANGO_SECURE_HSTS_PRELOAD requires DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS=true.")
SECURE_PROXY_SSL_HEADER = (
    ("HTTP_X_FORWARDED_PROTO", "https")
    if env_bool("DJANGO_TRUST_PROXY_SSL_HEADER", False)  # noqa: F405
    else None
)
# LL-235 will supply the PostgreSQL connection and migrations. No implicit
# SQLite production fallback, and health is strictly a process liveness probe.
DATABASES = {"default": {"ENGINE": "django.db.backends.dummy"}}
