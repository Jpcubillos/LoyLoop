"""Explicit live LL-235 verification; inactive disposable offer only, no points awarded."""
import argparse
from datetime import datetime,timezone
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import ssl
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit
from uuid import uuid4
from dotenv import dotenv_values
import psycopg

ROOT=Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--use-configured-demo',required=True,action='store_true')
    parser.add_argument('--resolved-host',action='append',default=[])
    args=parser.parse_args()
    web=dotenv_values(ROOT.parent/'.env.local',interpolate=False)
    provider=web['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')
    if provider!='https://phvuowulzkrttgcfnvly.supabase.co':raise RuntimeError('Unexpected test Auth project.')
    public_base=json.loads((ROOT/'.docker/public-url.json').read_text())['url']
    base='https://localhost:8443'
    local_tls=ssl.create_default_context(cafile=str(ROOT/'.docker/local-proxy-ca.crt'))
    # Optional per-process addresses from a fresh DNS query. Host/SNI and normal
    # certificate validation remain unchanged; no hosts/DNS settings are edited.
    allowed={urlsplit(provider).hostname,urlsplit(public_base).hostname,'localhost'}
    addresses={}
    for entry in args.resolved_host:
        host,address=entry.split('=',1)
        if host not in allowed:raise RuntimeError('Unexpected DNS override target.')
        addresses[host]=str(ipaddress.ip_address(address))
    original=socket.getaddrinfo
    socket.getaddrinfo=lambda host,port,*a,**k:original(addresses.get(host,host),port,*a,**k)
    source=(ROOT.parent/'components/auth-form.tsx').read_text()
    emails=[v for v in re.findall(r'setEmail\("([^"\n]+)"\)',source) if v.endswith('@loyloop.app')]
    passwords=[v for v in re.findall(r'setPassword\("([^"\n]+)"\)',source) if v]
    if not emails or not passwords:raise RuntimeError('No explicit configured demo account is available.')
    key=web['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
    login=urllib.request.Request(provider+'/auth/v1/token?grant_type=password',method='POST',
        headers={'Content-Type':'application/json','apikey':key},data=json.dumps({'email':emails[0],'password':passwords[0]}).encode())
    with urllib.request.urlopen(login,timeout=20) as response:auth=json.load(response)
    token=auth['access_token']
    private=ROOT/'.docker/validation-session.json'
    private.write_text(json.dumps({'access_token':token,'expires_at':auth.get('expires_at',int(time.time())+3600),'test_actor_id':auth['user']['id']}))
    private.chmod(0o600)
    def request(path,method='GET',body=None,expected=200,bearer=token):
        headers={'Content-Type':'application/json'}
        if bearer:headers['Authorization']='Bearer '+bearer
        req=urllib.request.Request(base+path,method=method,headers=headers,data=json.dumps(body).encode() if body is not None else None)
        try:
            with urllib.request.urlopen(req,timeout=30,context=local_tls) as response:status=response.status;raw=response.read()
        except urllib.error.HTTPError as exc:status=exc.code;raw=exc.read()
        if status!=expected:raise RuntimeError('Unexpected local API status at '+path+': '+str(status)+'; expected '+str(expected))
        return json.loads(raw) if raw else None
    for path in ['/health/','/ready/']:
        with urllib.request.urlopen(public_base+path,timeout=30) as response:
            assert response.status==200
    assert request('/health/')['status']=='ok'
    assert request('/ready/')['status']=='ready'
    request('/api/session/',expected=401,bearer=None)
    session=request('/api/session/')
    business=session['business_id']
    if not business:raise RuntimeError('The configured demo actor has no authorized commerce.')
    rewards='/api/businesses/'+business+'/rewards/'
    created=None
    try:
        created=request(rewards,'POST',{'name':'LL235 inactive verification '+uuid4().hex[:8],'type':'product','active':False},expected=201)
        assert any(row['id']==created['id'] for row in request(rewards))
        request(rewards+created['id']+'/','PATCH',{'business_id':str(uuid4())},expected=400)
        request(rewards+created['id']+'/','PATCH',{'description':'LL235 verified backend write'})
    finally:
        if created:request(rewards+created['id']+'/','DELETE',expected=204)
    for role,credential in [('anon',None),('authenticated',token)]:
        headers={'apikey':key,'Content-Type':'application/json'}
        if credential:headers['Authorization']='Bearer '+credential
        # Both filters cannot match a row, even if permissions were wrong.
        target=provider+'/rest/v1/business_memberships?id=eq.00000000-0000-0000-0000-000000000000&id=neq.00000000-0000-0000-0000-000000000000'
        req=urllib.request.Request(target,method='PATCH',headers=headers,data=b'{"points_balance":999}')
        try:
            with urllib.request.urlopen(req,timeout=20):raise RuntimeError('A direct client write was accepted.')
        except urllib.error.HTTPError as exc:
            payload=json.load(exc)
            if exc.code not in (401,403) or payload.get('code')!='42501':raise RuntimeError('The REST denial did not demonstrate database permission enforcement.')
    owner=dotenv_values(ROOT/'.env',interpolate=False)
    with psycopg.connect(host=owner['DB_HOST'],port=owner['DB_PORT'],dbname=owner['DB_NAME'],user=owner['DB_USER'],password=owner['DB_PASSWORD'],
            sslmode='verify-full',sslrootcert=str(ROOT/'supabase-ca.crt'),connect_timeout=15,prepare_threshold=None) as conn:
        conn.execute('SET TRANSACTION READ ONLY')
        count=conn.execute("SELECT count(*) FROM public.django_migrations WHERE app='loyalty'").fetchone()[0]
        assert count==8
        tables=[row[0] for row in conn.execute('SELECT table_name FROM public.loyloop_schema_adoptions')]
        for role in ['anon','authenticated']:
            for table in tables:
                assert not conn.execute("SELECT has_table_privilege(%s,%s,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(%s,%s,'INSERT,UPDATE,REFERENCES')",[role,'public.'+table,role,'public.'+table]).fetchone()[0]
            for fn in ['public.check_loyloop_account_deletion()','public.delete_loyloop_account()','public.loyloop_confirmed_auth_user(text)']:
                assert not conn.execute("SELECT has_function_privilege(%s,%s,'EXECUTE')",[role,fn]).fetchone()[0]
        assert conn.execute("SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname='loyloop_backend'").fetchone()==(False,False,False,False)
        conn.rollback()
    report={'timestamp_utc':datetime.now(timezone.utc).isoformat(),'migrations_applied':count,'health':'passed','readiness':'passed','real_auth':'passed_local_https','public_health_without_credentials':'passed',
        'inactive_offer_crud':'passed','test_offer_removed':True,'foreign_tenant_mutation':'rejected',
        'direct_anon_rest_write':'denied_42501','direct_authenticated_rest_write':'denied_42501',
        'managed_tables_client_write_grants':'none','private_auth_functions_client_execution':'denied','backend_role':'least_privilege'}
    (ROOT/'.docker/ll235-live-evidence.json').write_text(json.dumps(report,indent=2))
    print('LL-235 live verification passed: HTTPS ready, real Auth/scoped CRUD, direct anon/authenticated REST mutations rejected, managed-table writes and private Auth RPCs denied to clients.')


if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('Live verification failed:',type(exc).__name__)
        if isinstance(exc,RuntimeError):print(str(exc))
        raise SystemExit(1) from None
