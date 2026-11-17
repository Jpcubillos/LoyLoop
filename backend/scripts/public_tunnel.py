"""Explicit temporary public HTTPS URL. Does not activate APIs or apply migrations."""
import argparse
import json
from pathlib import Path
import re
import ssl
import subprocess
import time
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
BASE=['docker','compose','--env-file',str(ROOT/'docker/compose.env'),'-f',str(ROOT/'compose.yaml')]
PUBLIC=BASE+['-f',str(ROOT/'compose.public.yaml')]
URL_PATTERN=re.compile(r'https://[a-z0-9-]+\.trycloudflare\.com\b')


def command(args):
    return subprocess.run(args,cwd=ROOT,check=True,capture_output=True,text=True).stdout


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('action',choices=['up','down','url'])
    args=parser.parse_args()
    path=ROOT/'.docker/public-url.json'
    if args.action=='down':
        command(PUBLIC+['stop','tunnel'])
        if path.exists(): path.unlink()
        print('Temporary public tunnel stopped; local Django remains running.')
        return
    if args.action=='url':
        logs=command(PUBLIC+['logs','--no-color','--tail','100','tunnel'])
        urls=URL_PATTERN.findall(logs)
        if not urls: raise RuntimeError('No temporary tunnel URL found. Start the tunnel first.')
        print(urls[-1])
        return
    cert=ROOT/'.docker/local-proxy-ca.crt'
    cert.parent.mkdir(exist_ok=True)
    command(BASE+['cp','proxy:/data/caddy/pki/authorities/local/root.crt',str(cert)])
    context=ssl.create_default_context(cafile=str(cert))
    with urllib.request.urlopen('https://localhost:8443/health/',context=context,timeout=10) as response:
        if response.status!=200 or json.load(response)!={'status':'ok'}:
            raise RuntimeError('Local HTTPS origin is not healthy.')
    command(PUBLIC+['up','--detach','--no-build','tunnel'])
    deadline=time.monotonic()+90
    url=None
    while time.monotonic()<deadline:
        urls=URL_PATTERN.findall(command(PUBLIC+['logs','--no-color','--tail','100','tunnel']))
        if urls:
            url=urls[-1]
            try:
                with urllib.request.urlopen(url+'/health/',timeout=10) as response:
                    if response.status==200 and json.load(response)=={'status':'ok'}:
                        break
            except (urllib.error.URLError,TimeoutError,ValueError):
                pass
        time.sleep(1)
    else:
        raise RuntimeError('Public tunnel did not pass HTTPS health verification in time.')
    ready=False
    try:
        with urllib.request.urlopen(url+'/ready/',timeout=20) as response:
            ready=response.status==200 and json.load(response)=={'status':'ready'}
    except urllib.error.HTTPError as exc:
        if exc.code!=503: raise
    path.write_text(json.dumps({'url':url,'temporary':True,'ready':ready},indent=2))
    print('Verified temporary public HTTPS URL:',url)
    print('Readiness:', 'ready' if ready else 'NOT READY: schema/client cutover still pending')
    print('Available only while this PC, Docker and the tunnel are running; URL may change on restart.')


if __name__=='__main__':
    try: main()
    except Exception as exc:
        print('Public tunnel operation failed ('+type(exc).__name__+'). No database changes were requested.')
        raise SystemExit(1) from None
