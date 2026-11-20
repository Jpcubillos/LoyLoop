"""Local Docker deployment with production checks and mounted runtime secrets."""
import os
from pathlib import Path
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

config_file = Path(os.environ.get('DATABASE_CONFIG_FILE', '/run/secrets/backend_env'))
if not config_file.is_file():
    raise ImproperlyConfigured('Docker requires its mounted backend configuration secret.')
load_dotenv(config_file, override=False, interpolate=False)

from .postgres_production import *  # noqa: E402,F403
