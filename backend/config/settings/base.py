"""Shared API configuration. Environment variables are the sole source of secrets."""
import os
import re
from pathlib import Path
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parents[2]


def required_secret(name):
    value = os.environ.get(name, "")
    if len(value.strip()) < 50 or len(set(value)) < 5:
        raise ImproperlyConfigured(f"{name} is required and must contain at least 50 sufficiently varied characters.")
    return value


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in ("true", "1"):
        return True
    if normalized in ("false", "0"):
        return False
    raise ImproperlyConfigured(f"{name} must be true or false.")


def env_list(name, default=""):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


def hosts(required=False):
    allowed = env_list("DJANGO_ALLOWED_HOSTS", "" if required else "localhost,127.0.0.1,[::1]")
    if not allowed:
        raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must contain at least one host.")
    for host in allowed:
        if not re.fullmatch(r"(?:\[[0-9a-fA-F:]+\]|[A-Za-z0-9][A-Za-z0-9.-]*)", host):
            raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must contain explicit hostnames or IPs without scheme or port.")
    return allowed


def cors_origins(production=False):
    origins = env_list("DJANGO_CORS_ALLOWED_ORIGINS")
    for origin in origins:
        try:
            parsed = urlsplit(origin)
            port = parsed.port  # Validate the port, even if unused.
            del port
        except ValueError as exc:
            raise ImproperlyConfigured("DJANGO_CORS_ALLOWED_ORIGINS contains an invalid origin.") from exc
        if (parsed.scheme not in ({"https"} if production else {"http", "https"})
                or not parsed.hostname or parsed.username or parsed.password
                or "*" in parsed.netloc or parsed.path or parsed.query or parsed.fragment):
            raise ImproperlyConfigured("DJANGO_CORS_ALLOWED_ORIGINS must contain explicit origins without paths; production requires HTTPS.")
    return origins


SECRET_KEY = required_secret("DJANGO_SECRET_KEY")
SECRET_KEY_FALLBACKS = []
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"
INSTALLED_APPS = ["django.contrib.auth", "django.contrib.contenttypes", "django.contrib.sessions", "corsheaders", "rest_framework"]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = False
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"
USE_TZ = True
TIME_ZONE = "America/Bogota"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
