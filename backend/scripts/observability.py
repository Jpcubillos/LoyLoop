"""Start monitoring or rehearse a readiness alert only in isolated staging."""
import argparse
from datetime import datetime,timezone
import json
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.request
from dotenv import dotenv_values

ROOT=Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('action',choices=['up','check','test-alert','test-liveness-alert'])
    args=parser.parse_args()
    state=json.loads((ROOT/'.docker/staging-state.json').read_text())
    if not re.fullmatch('loyloop-stage-[a-f0-9]{8}',state['project']):
        raise RuntimeError('Unexpected staging project.')
    base=['docker','compose','--env-file',str(ROOT/'docker/compose.env'),
        '--project-name',state['project'],'-f',str(ROOT/'compose.staging.yaml')]
    overlay=base+['-f',str(ROOT/'compose.observability.yaml')]
    def command(arguments):
        result=subprocess.run(arguments,cwd=ROOT,capture_output=True,text=True)
        if result.returncode:
            (ROOT/'.docker/observability-private-diagnostic.log').write_text(result.stdout+result.stderr)
            raise RuntimeError('Monitoring command failed; private diagnostic saved.')
        return result.stdout
    database=state.get('recovery_container') or command(base+['ps','-q','database']).strip()
    if not database or command(['docker','inspect','--format','{{.HostConfig.NetworkMode}}',database]).strip()!='none':
        raise RuntimeError('Only the recorded no-network staging database is permitted.')
    env=dotenv_values(ROOT/'.docker/staging.env',interpolate=False)
    token=ROOT/'.docker/staging-metrics-token'
    if token.exists() and token.read_text()!=env['METRICS_BEARER_TOKEN']:
        raise RuntimeError('Existing monitoring secret differs; it will not be overwritten.')
    if not token.exists():
        token.write_text(env['METRICS_BEARER_TOKEN']);token.chmod(0o600)
    if args.action=='up':
        command(overlay+['up','--detach','prometheus','alertmanager','blackbox','alert-receiver'])
        # Bind-mounted configuration content does not recreate the service.
        command(overlay+['restart','alertmanager','prometheus'])
    def query(path):
        with urllib.request.urlopen('http://127.0.0.1:19090'+path,timeout=10) as response:
            return json.load(response)
    def metrics_ready():
        result=query('/api/v1/query?query=up%7Bjob%3D%22loyloop-django%22%7D')['data']['result']
        probes=query('/api/v1/query?query=probe_success%7Bjob%3D%22loyloop-probes%22%7D')['data']['result']
        return len(result)==1 and result[0]['value'][1]=='1' and len(probes)==2 and all(row['value'][1]=='1' for row in probes)
    deadline=time.monotonic()+60
    while time.monotonic()<deadline:
        try:
            if metrics_ready():break
        except (OSError,ValueError,KeyError):pass
        time.sleep(2)
    else:raise RuntimeError('Metrics and verified-TLS probes did not become healthy.')
    if args.action in {'up','check'}:
        print('Prometheus scrape and HTTPS health/readiness probes passed. Monitoring UI: http://localhost:19090')
        return

    liveness=args.action=='test-liveness-alert'
    alert_name='LoyLoopLivenessDown' if liveness else 'LoyLoopReadinessDown'
    target=command(base+['ps','-q','api']).strip() if liveness else database
    since=time.time()
    def received(status):
        logs=command(overlay+['logs','--no-color','--no-log-prefix','--tail','500','alert-receiver'])
        for line in logs.splitlines():
            if not line.startswith('{'):continue
            event=json.loads(line)
            if (event.get('event')=='operational_alert' and event.get('alert')==alert_name
                    and event.get('status')==status and datetime.fromisoformat(event['timestamp']).timestamp()>=since):
                return True
        return False
    started=time.monotonic()
    try:
        command(['docker','stop',target])
        print('Stopped only the isolated staging '+('API' if liveness else 'database')+'; waiting for independent alert delivery.',flush=True)
        deadline=time.monotonic()+100
        while time.monotonic()<deadline:
            alerts=query('/api/v1/alerts')['data']['alerts']
            firing=any(row['labels'].get('alertname')==alert_name and row['state']=='firing' for row in alerts)
            if firing and received('firing'):break
            time.sleep(2)
        else:raise RuntimeError('The independent '+alert_name+' notification was not delivered.')
    finally:
        command(['docker','start',target])
    deadline=time.monotonic()+90
    while time.monotonic()<deadline:
        if metrics_ready() and received('resolved'):break
        time.sleep(2)
    else:raise RuntimeError('The restored staging service or resolved alert did not recover.')
    evidence={'timestamp_utc':datetime.now(timezone.utc).isoformat(),
        'scope':'isolated restored-copy Docker staging','alert_name':alert_name,'independent_receiver':True,
        'metrics_scrape':'passed','verified_tls_probes':'passed',
        'readiness_alert_firing_delivery':'passed','readiness_alert_resolved_delivery':'passed',
        'database_network':'none','duration_seconds':round(time.monotonic()-started,2)}
    (ROOT/('.docker/liveness-evidence.json' if liveness else '.docker/observability-evidence.json')).write_text(json.dumps(evidence,indent=2))
    print('Real '+alert_name+' rehearsal passed: failure detected, independent firing notification received, target restarted and resolved notification received.')


if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('Monitoring operation failed ('+type(exc).__name__+'). Only isolated staging was targeted.')
        if isinstance(exc,RuntimeError):print(str(exc))
        raise SystemExit(1) from None
