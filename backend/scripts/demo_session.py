"""Explicit configured test-account login for local operational rehearsals only."""
import json
import socket
import ipaddress
from pathlib import Path
import re
import time
import urllib.request
from dotenv import dotenv_values


def configured_test_session(root,resolved_address=None):
    web=dotenv_values(Path(root).parent/'.env.local',interpolate=False)
    provider=web['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')
    if provider!='https://phvuowulzkrttgcfnvly.supabase.co':
        raise RuntimeError('Unexpected Auth project for the configured test account.')
    source=(Path(root).parent/'components/auth-form.tsx').read_text(encoding='utf-8')
    emails=[v for v in re.findall(r'setEmail\("([^"\n]+)"\)',source) if v.endswith('@loyloop.app')]
    passwords=re.findall(r'setPassword\("([^"\n]+)"\)',source)
    if not emails or not passwords:raise RuntimeError('No explicitly configured test account exists.')
    class NoRedirects(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    request=urllib.request.Request(provider+'/auth/v1/token?grant_type=password',method='POST',
        headers={'Content-Type':'application/json','apikey':web['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']},
        data=json.dumps({'email':emails[0],'password':passwords[0]}).encode())
    original=socket.getaddrinfo
    if resolved_address:
        address=str(ipaddress.ip_address(resolved_address))
        socket.getaddrinfo=lambda host,port,*a,**k:original(address if host=='phvuowulzkrttgcfnvly.supabase.co' else host,port,*a,**k)
    try:
        with urllib.request.build_opener(NoRedirects()).open(request,timeout=20) as response:
            session=json.loads(response.read(131072))
    finally:
        socket.getaddrinfo=original
    return {'access_token':session['access_token'],'test_actor_id':session['user']['id'],
        'expires_at':int(time.time())+session['expires_in']}
