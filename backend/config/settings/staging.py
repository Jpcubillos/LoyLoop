"""Explicit restored-copy staging. PostgreSQL has no network interface."""
import os
from django.core.exceptions import ImproperlyConfigured
from .production import *  # noqa: F403

if os.environ.get('LL235_ISOLATED_DATABASE')!='yes' or os.environ.get('LL235_STAGING_REHEARSAL')!='yes':
    raise ImproperlyConfigured('Restored-copy staging must be explicitly enabled.')
INSTALLED_APPS=['corsheaders','rest_framework','loyalty']
MIDDLEWARE=[entry for entry in MIDDLEWARE if entry not in {
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
}]
REST_FRAMEWORK={**REST_FRAMEWORK,'UNAUTHENTICATED_USER':None}
DATABASES={'default':{
    'ENGINE':'django.db.backends.postgresql','HOST':'/run/pgsocket',
    'NAME':'loyloop_restore','PORT':'5432','USER':os.environ.get('DB_USER',''),'PASSWORD':os.environ['DB_PASSWORD'],
    'CONN_MAX_AGE':0,'DISABLE_SERVER_SIDE_CURSORS':True,
    'OPTIONS':{'sslmode':'disable','prepare_threshold':None,
        'application_name':'loyloop-isolated-staging',
        'pool':{'min_size':0,'max_size':3,'timeout':10,'max_waiting':20}},
}}
BUSINESS_API_ENABLED=True

if DATABASES['default']['USER']!=('postgres' if os.environ.get('STAGING_MAINTENANCE')=='yes' else 'loyloop_backend'):
    raise ImproperlyConfigured('Staging API requires the minimum runtime role; only the maintenance job may use postgres.')
