"""Initialize local Docker secrets without printing them or contacting a database."""
from pathlib import Path
import secrets
from dotenv import dotenv_values

root = Path(__file__).resolve().parents[1]
env = root / '.env'
if not env.is_file() or not (root/'supabase-ca.crt').is_file():
    raise SystemExit('Requires backend/.env and backend/supabase-ca.crt first.')
values = dotenv_values(env, interpolate=False)
for name in ('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'):
    if not values.get(name):
        raise SystemExit('Required database configuration is missing. Check backend/.env privately.')
key = values.get('DJANGO_SECRET_KEY')
if key and (len(key.strip()) < 50 or len(set(key)) < 5):
    raise SystemExit('Existing DJANGO_SECRET_KEY is invalid; no automatic replacement performed.')
if not key:
    if 'DJANGO_SECRET_KEY' in values:
        raise SystemExit('DJANGO_SECRET_KEY is empty; remove its empty declaration before initialization.')
    with env.open('a', encoding='utf-8') as output:
        output.write('\nDJANGO_SECRET_KEY="' + secrets.token_urlsafe(64) + '"\n')
print('Local Docker configuration present. Secret key initialized if missing; no database changes.')
