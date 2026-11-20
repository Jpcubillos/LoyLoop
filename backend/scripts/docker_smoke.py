"""Verify local HTTPS with the local CA; report readiness without hiding failure."""
import json
from pathlib import Path
import ssl
import subprocess
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ['docker', 'compose', '--env-file', str(ROOT/'docker/compose.env'), '-f', str(ROOT/'compose.yaml')]
cert = ROOT/'.docker/local-proxy-ca.crt'
cert.parent.mkdir(exist_ok=True)
subprocess.run(COMPOSE + ['cp', 'proxy:/data/caddy/pki/authorities/local/root.crt', str(cert)], check=True, cwd=ROOT)
context = ssl.create_default_context(cafile=str(cert))
with urllib.request.urlopen('https://localhost:8443/health/', context=context, timeout=15) as response:
    assert response.status == 200
    assert json.load(response) == {'status': 'ok'}
print('Docker HTTPS/liveness: passed with local CA and hostname verification.')
try:
    with urllib.request.urlopen('https://localhost:8443/ready/', context=context, timeout=20) as response:
        assert response.status == 200 and json.load(response) == {'status': 'ready'}
except urllib.error.HTTPError as exc:
    if exc.code != 503:
        raise
    print('Docker readiness: NOT READY (503). Database adoption/migrations still need completion.')
    raise SystemExit(2) from None
print('Docker readiness: passed.')
