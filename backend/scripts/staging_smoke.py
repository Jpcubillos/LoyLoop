"""Real Supabase Auth + HTTPS API + restored-copy PostgreSQL validation."""
import json
from pathlib import Path
import ssl
import subprocess
import time
import urllib.error
import urllib.request
from dotenv import dotenv_values

ROOT=Path(__file__).resolve().parents[1]


def main():
    state=json.loads((ROOT/'.docker/staging-state.json').read_text())
    session=json.loads((ROOT/'.docker/validation-session.json').read_text())
    if state.get('local_url')!='https://localhost:8444' or not state.get('project','').startswith('loyloop-stage-'):
        raise RuntimeError('Only the recorded local HTTPS staging origin is permitted.')
    if state['status']!='ready' or session['expires_at']<=time.time():
        raise RuntimeError('Ready staging and an unexpired private test session are required.')
    token=session['access_token']
    env=dotenv_values(ROOT/'.docker/staging.env',interpolate=False)
    compose=['docker','compose','--env-file',str(ROOT/'docker/compose.env'),
        '--project-name',state['project'],'-f',str(ROOT/'compose.staging.yaml')]
    context=ssl.create_default_context(cafile=str(ROOT/'.docker/staging-ca.crt'))
    class NoRedirects(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    opener=urllib.request.build_opener(urllib.request.HTTPSHandler(context=context),NoRedirects())
    def command(args):
        r=subprocess.run(compose+args,cwd=ROOT,capture_output=True,text=True)
        if r.returncode:
            (ROOT/'.docker/staging-smoke-private.log').write_text(r.stdout+r.stderr)
            raise RuntimeError('Staging container operation failed; private diagnostic saved.')
        return r.stdout
    fixture=json.loads(command(['exec','-T','api','python','scripts/staging_entry.py','python','manage.py','staging_fixture','--actor',session['test_actor_id']]))

    def request(path,method='GET',body=None,credential=token,expected=200):
        headers={'Content-Type':'application/json'}
        if credential:headers['Authorization']='Bearer '+credential
        req=urllib.request.Request(state['local_url']+path,method=method,headers=headers,
            data=json.dumps(body).encode() if body is not None else None)
        try:
            with opener.open(req,timeout=20) as response:
                status=response.status;raw=response.read()
        except urllib.error.HTTPError as exc:
            status=exc.code;raw=exc.read()
        if status!=expected:
            raise RuntimeError('Unexpected staging HTTP result: '+str(status)+' expected '+str(expected))
        return json.loads(raw) if raw else None

    request('/api/session/',credential=None,expected=401)
    request('/api/session/',credential='invalid-test-session',expected=401)
    current=request('/api/session/')
    if current['id']!=session['test_actor_id']:
        raise RuntimeError('Staging did not authenticate the intended verified actor.')
    base='/api/businesses/'+fixture['own']
    reward=request(base+'/rewards/','POST',{'name':'LL235 isolated reward','type':'product'},expected=201)
    if not any(row['id']==reward['id'] for row in request(base+'/rewards/')):
        raise RuntimeError('Created offer did not persist.')
    request(base+'/rewards/'+reward['id']+'/','PATCH',{'business_id':fixture['foreign']},expected=400)
    request(base+'/rewards/'+reward['id']+'/','PATCH',{'name':'LL235 updated'})
    request(base+'/rewards/'+reward['id']+'/','DELETE',expected=204)
    membership='/api/memberships/'+fixture['own']+'/'
    request(membership,'POST',{'points_balance':999},expected=400)
    request(membership,'POST',{},expected=201)
    request(membership,'POST',{},expected=200)
    claim=request('/api/claim-requests/','POST',{'actionType':'stamp_add','businessSlug':fixture['slug'],'payload':{'rewardPoints':999}},expected=201)
    code=claim['code']
    request('/api/businesses/'+fixture['foreign']+'/validate-claim/','POST',{'code':code},expected=403)
    request(base+'/validate-claim/','POST',{'code':code})
    request(base+'/validate-claim/','POST',{'code':code},expected=409)
    if request('/api/claim-requests/'+code+'/')['status']!='approved':
        raise RuntimeError('Merchant approval did not persist.')
    command(['exec','-T','api','python','scripts/staging_entry.py','python','manage.py','staging_fixture','--actor',session['test_actor_id'],'--verify-business',fixture['own']])
    # Metrics use text rather than JSON; check via its own authenticated request.
    req=urllib.request.Request(state['local_url']+'/internal/metrics/',headers={'Authorization':'Bearer '+env['METRICS_BEARER_TOKEN']})
    with opener.open(req,timeout=15) as response:
        if response.status!=200 or b'loyloop_http_requests_total' not in response.read():
            raise RuntimeError('Staging metrics verification failed.')
    logs=command(['logs','--no-color','--no-log-prefix','api'])
    if code in logs or token in logs:
        raise RuntimeError('Staging log contains a sensitive claim/session value.')
    events=[json.loads(line) for line in logs.splitlines() if line.startswith('{')]
    if not any(row.get('event')=='business_action' and row.get('actor_id')==session['test_actor_id'] and row.get('tenant_id')==fixture['own'] and row.get('trace_id') for row in events):
        raise RuntimeError('No correlated actor/tenant audit event found.')
    state['real_auth_smoke']='passed'
    state['real_auth_scope']='configured demo session; synthetic tenants in the isolated restored copy'
    (ROOT/'.docker/staging-state.json').write_text(json.dumps(state,indent=2))
    print('Real HTTPS staging passed: Supabase Auth, offer CRUD, tenant rejection, zero-balance join, QR validation/replay, persisted points/stamps and redacted actor/tenant traces.')
    print('All business mutations were limited to the isolated restored copy; remote Supabase business data unchanged.')


if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('Staging smoke failed ('+type(exc).__name__+'). No remote business writes were requested.')
        if isinstance(exc,RuntimeError):print(str(exc))
        raise SystemExit(1) from None
