"""Exercise Django's deployment checks without storing a real secret."""
import os
from pathlib import Path
import secrets
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
env = {k: v for k, v in os.environ.items() if not k.startswith("DJANGO_")}
env.update({
    "DJANGO_SETTINGS_MODULE": "config.settings.production",
    "DJANGO_SECRET_KEY": secrets.token_urlsafe(64),
    "DJANGO_ALLOWED_HOSTS": "api.example.org",
    # Only for the fictitious CI domain. Real domains require an explicit decision.
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS": "true",
    "DJANGO_SECURE_HSTS_PRELOAD": "true",
})
raise SystemExit(subprocess.call(
    [sys.executable, "manage.py", "check", "--deploy", "--fail-level", "WARNING"],
    cwd=ROOT, env=env,
))
