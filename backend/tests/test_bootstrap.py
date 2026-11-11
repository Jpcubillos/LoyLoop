"""Isolated configuration and HTTP contract tests for LL-232."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
KEY = secrets.token_urlsafe(64)


def run_python(args, *, settings="config.settings.local", variables=None):
    env = {k: v for k, v in os.environ.items() if not k.startswith("DJANGO_")}
    env["DJANGO_SETTINGS_MODULE"] = settings
    env.update(variables or {})
    return subprocess.run([sys.executable, *args], cwd=ROOT, env=env, capture_output=True, text=True, timeout=30)


def inspect(settings="config.settings.local", variables=None):
    script = """import os,json,django
django.setup()
from django.conf import settings as s
print(json.dumps({'debug':s.DEBUG,'hosts':s.ALLOWED_HOSTS,'cors':s.CORS_ALLOWED_ORIGINS,'ssl':s.SECURE_SSL_REDIRECT,'proxy':s.SECURE_PROXY_SSL_HEADER,'session_cookie':s.SESSION_COOKIE_SECURE,'csrf_cookie':s.CSRF_COOKIE_SECURE,'hsts':s.SECURE_HSTS_SECONDS,'db':s.DATABASES['default']['ENGINE'],'permissions':s.REST_FRAMEWORK['DEFAULT_PERMISSION_CLASSES']}))"""
    return run_python(["-c", script], settings=settings, variables=variables)


class BootstrapTests(unittest.TestCase):
    def test_missing_and_short_secrets_fail_without_echoing_value(self):
        for value in (None, "short"):
            variables = {} if value is None else {"DJANGO_SECRET_KEY": value}
            result = run_python(["manage.py", "check"], variables=variables)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("DJANGO_SECRET_KEY", result.stderr)
            if value:
                self.assertNotIn(value, result.stderr)

    def test_local_health_and_drf_are_available(self):
        script = """import django; django.setup()
from django.test import Client
from django.conf import settings
assert 'rest_framework' in settings.INSTALLED_APPS
r=Client(HTTP_HOST='localhost').get('/health/')
assert r.status_code == 200, r.status_code
assert r.json() == {'status':'ok'}, r.content
assert 'Cache-Control' in r and 'no-store' in r['Cache-Control']
assert Client(HTTP_HOST='evil.example').get('/health/').status_code == 400
"""
        result = run_python(["-c", script], variables={"DJANGO_SECRET_KEY": KEY})
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_wsgi_and_asgi_entrypoints_start_with_valid_settings(self):
        script = "import config.wsgi, config.asgi; assert callable(config.wsgi.application); assert callable(config.asgi.application)"
        result = run_python(["-c", script], settings="config.settings.production", variables={
            "DJANGO_SECRET_KEY": KEY, "DJANGO_ALLOWED_HOSTS": "api.example.org",
        })
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_production_requires_explicit_hosts(self):
        result = inspect("config.settings.production", {"DJANGO_SECRET_KEY": KEY})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_ALLOWED_HOSTS", result.stderr)

    def test_production_security_defaults_and_explicit_cors(self):
        result = inspect("config.settings.production", {
            "DJANGO_SECRET_KEY": KEY,
            "DJANGO_ALLOWED_HOSTS": "api.example.org",
            "DJANGO_CORS_ALLOWED_ORIGINS": "https://panel.example.org",
        })
        self.assertEqual(result.returncode, 0, result.stderr)
        cfg = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertFalse(cfg["debug"])
        self.assertEqual(cfg["hosts"], ["api.example.org"])
        self.assertEqual(cfg["cors"], ["https://panel.example.org"])
        self.assertTrue(cfg["ssl"] and cfg["session_cookie"] and cfg["csrf_cookie"])
        self.assertIsNone(cfg["proxy"])
        self.assertGreaterEqual(cfg["hsts"], 31536000)
        self.assertEqual(cfg["db"], "django.db.backends.dummy")
        self.assertEqual(cfg["permissions"], ["rest_framework.permissions.IsAuthenticated"])

    def test_insecure_production_configuration_fails_closed(self):
        for name, value in (
            ("DJANGO_ALLOWED_HOSTS", "*"),
            ("DJANGO_ALLOWED_HOSTS", ".example.org"),
            ("DJANGO_ALLOWED_HOSTS", "https://example.org"),
            ("DJANGO_CORS_ALLOWED_ORIGINS", "*"),
            ("DJANGO_CORS_ALLOWED_ORIGINS", "http://example.org"),
            ("DJANGO_CORS_ALLOWED_ORIGINS", "https://example.org/path"),
            ("DJANGO_DEBUG", "true"),
            ("DJANGO_SECURE_SSL_REDIRECT", "false"),
            ("DJANGO_TRUST_PROXY_SSL_HEADER", "maybe"),
            ("DJANGO_SECURE_HSTS_SECONDS", "0"),
            ("DJANGO_SECURE_HSTS_PRELOAD", "true"),
        ):
            env = {"DJANGO_SECRET_KEY": KEY, "DJANGO_ALLOWED_HOSTS": "api.example.org", name: value}
            with self.subTest(variable=name, value=value):
                result = inspect("config.settings.production", env)
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertIn(name, result.stderr)

    def test_proxy_header_is_opt_in_and_cors_is_not_wildcard(self):
        result = inspect("config.settings.production", {
            "DJANGO_SECRET_KEY": KEY, "DJANGO_ALLOWED_HOSTS": "api.example.org",
            "DJANGO_TRUST_PROXY_SSL_HEADER": "true",
            "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS": "true",
            "DJANGO_SECURE_HSTS_PRELOAD": "true",
        })
        self.assertEqual(result.returncode, 0, result.stderr)
        cfg = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertEqual(cfg["proxy"], ["HTTP_X_FORWARDED_PROTO", "https"])
        self.assertEqual(cfg["cors"], [])

    def test_production_http_redirects_and_forged_proxy_header_is_ignored(self):
        script = """import django; django.setup()
from django.test import Client
c=Client(HTTP_HOST='api.example.org')
plain=c.get('/health/', HTTP_X_FORWARDED_PROTO='https')
assert plain.status_code == 301 and plain['Location'] == 'https://api.example.org/health/'
secure=c.get('/health/', secure=True)
assert secure.status_code == 200 and secure.json() == {'status':'ok'}
assert secure['Strict-Transport-Security'] == 'max-age=31536000'
"""
        result = run_python(["-c", script], settings="config.settings.production", variables={
            "DJANGO_SECRET_KEY": KEY, "DJANGO_ALLOWED_HOSTS": "api.example.org",
        })
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_cors_preflight_only_grants_configured_origins(self):
        script = """import django; django.setup()
from django.test import Client
c=Client(HTTP_HOST='localhost')
def call(origin): return c.options('/health/', HTTP_ORIGIN=origin, HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET')
assert call('http://localhost:8081').headers.get('access-control-allow-origin') == 'http://localhost:8081'
assert 'access-control-allow-origin' not in call('https://evil.example').headers
"""
        result = run_python(["-c", script], variables={"DJANGO_SECRET_KEY": KEY, "DJANGO_CORS_ALLOWED_ORIGINS": "http://localhost:8081"})
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
