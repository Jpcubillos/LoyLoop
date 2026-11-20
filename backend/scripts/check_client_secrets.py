"""Scan versioned client sources/config templates for privileged keys; never echo values."""
import base64,json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
files=subprocess.run(['git','ls-files','mobile/src','mobile/.env.example','app','components','lib','.env.example'],cwd=ROOT,check=True,capture_output=True,text=True).stdout.splitlines()
for name in files:
    text=(ROOT/name).read_text(encoding='utf-8')
    if re.search(r'sb_secret_[A-Za-z0-9_-]{12,}',text):raise SystemExit('Privileged Supabase key in client source: '+name)
    for token in re.findall(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',text):
        try:claims=json.loads(base64.urlsafe_b64decode(token.split('.')[1]+'==='))
        except (ValueError,UnicodeError):continue
        if claims.get('role')=='service_role':raise SystemExit('Service-role JWT in client source: '+name)
print('Versioned client sources contain no literal Supabase service keys.')
