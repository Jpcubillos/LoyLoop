"""Loopback-only local API using the private runtime role; never runs migrations."""
import os
from pathlib import Path
import sys
from dotenv import dotenv_values
ROOT=Path(__file__).resolve().parents[1]
values=dotenv_values(ROOT/'.docker/runtime.env',interpolate=False)
if not str(values.get('DB_USER','')).startswith('loyloop_backend.'):
    raise SystemExit('The separate runtime configuration is required.')
for key,value in values.items():
    if value is not None:os.environ[key]=value
os.environ.update(DJANGO_SETTINGS_MODULE='config.settings.postgres',DJANGO_DEBUG='false',
    DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1',DJANGO_BUSINESS_API_ENABLED='true',
    DJANGO_CORS_ALLOWED_ORIGINS='http://localhost:8092,http://127.0.0.1:8092',
    DB_SSLROOTCERT=str(ROOT/'supabase-ca.crt'))
os.chdir(ROOT)
os.execv(sys.executable,[sys.executable,'manage.py','runserver','127.0.0.1:8001','--noreload'])
