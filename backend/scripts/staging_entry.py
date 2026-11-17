"""Load only the isolated staging secret, then run the requested process."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

path=Path(os.environ.get('DATABASE_CONFIG_FILE','/run/secrets/staging_env'))
if not path.is_file():
    raise SystemExit('Staging secret is required.')
load_dotenv(path,override=False,interpolate=False)
os.environ['DJANGO_SETTINGS_MODULE']='config.settings.staging'
if len(sys.argv)>1:
    os.execvp(sys.argv[1],sys.argv[1:])
os.execvp('python',['python','scripts/start_api.py'])
