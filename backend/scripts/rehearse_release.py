"""Explicit LL-244 release/rollback/restore rehearsal, isolated Docker staging only."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import ssl
import subprocess
import time
import urllib.request
from uuid import uuid4

ROOT=Path(__file__).resolve().parents[1]
PG_IMAGE='postgres:17@sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac'


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--archive',type=Path,required=True)
    parser.add_argument('--apply',action='store_true',required=True)
    parser.add_argument('--resolved-auth-address')
    parser.add_argument('--skip-restore',action='store_true')
    parser.add_argument('--inject-failure',choices=['migration','readiness'])
    args=parser.parse_args()
    archive=args.archive.resolve()
    if not archive.is_relative_to((ROOT/'.docker/backups').resolve()) or archive.name!='database.dump':
        raise RuntimeError('Only the authorized private backup directory is accepted.')
    evidence=json.loads(archive.with_name('evidence.json').read_text())
    if evidence.get('restore')!='passed' or hashlib.sha256(archive.read_bytes()).hexdigest()!=evidence['archive_sha256']:
        raise RuntimeError('Archive fingerprint or prior restore verification is invalid.')
    stage=json.loads((ROOT/'.docker/staging-state.json').read_text())
    if stage.get('status')!='ready' or not re.fullmatch(r'loyloop-stage-[a-f0-9]{8}',stage['project']):
        raise RuntimeError('A recorded ready isolated staging deployment is required.')
    if stage.get('local_url')!='https://localhost:8444':
        raise RuntimeError('Only the local HTTPS staging origin is permitted.')
    run_id=uuid4().hex[:12]
    state_path=ROOT/('.docker/ll244-release-'+run_id+'.json')
    if stage.get('recovery_container'):
        database=stage['recovery_container']
        check=subprocess.run(['docker','inspect','--format','{{.HostConfig.NetworkMode}}',database],capture_output=True,text=True,check=True)
        if check.stdout.strip()!='none':raise RuntimeError('The active recovered database must remain isolated.')
    diagnostic=ROOT/'.docker/ll244-release-private.log'
    def command(args,data=None):
        result=subprocess.run(args,cwd=ROOT,input=data,capture_output=True)
        if result.returncode:
            diagnostic.write_bytes(result.stdout+result.stderr)
            raise RuntimeError('An isolated deployment command failed; private diagnostic saved.')
        return result.stdout.decode()
    base=['docker','compose','--env-file',str(ROOT/'docker/compose.env'),'--project-name',stage['project'],'-f',str(ROOT/'compose.staging.yaml')]
    database=command(base+['ps','-q','database']).strip()
    if not database or command(['docker','inspect','--format','{{.HostConfig.NetworkMode}}',database]).strip()!='none':
        raise RuntimeError('The recorded staging database must have no network.')
    api=command(base+['ps','-q','api']).strip()
    old=command(['docker','inspect','--format','{{.Image}}',api]).strip()
    revision=command(['git','-C',str(ROOT.parent),'rev-parse','HEAD']).strip()
    if command(['git','-C',str(ROOT.parent),'status','--porcelain']).strip():
        raise RuntimeError('Commit the reviewed source before building an immutable release.')
    state={'started_utc':datetime.now(timezone.utc).isoformat(),'project':stage['project'],'source_commit':revision,'previous_image':old,'status':'building'}
    state_path.write_text(json.dumps(state,indent=2))
    tag='loyloop-django:ll244-'+revision[:12]
    command(['docker','build','--label','org.opencontainers.image.revision='+revision,'--tag',tag,str(ROOT)])
    new=command(['docker','image','inspect','--format','{{.Id}}',tag]).strip()
    # Redeploying the same immutable artifact is valid and must be repeatable.
    state.update(candidate_image=new,status='deploying');state_path.write_text(json.dumps(state,indent=2))
    override=ROOT/'.docker/ll244-release-override.json'
    active_socket=stage.get('recovery_socket')
    original_override=override.read_text() if override.exists() else None
    def compose(image,socket=None,broken=False):
        socket=socket or active_socket
        content={'services':{'api':{'image':image},'maintenance':{'image':image}}}
        if broken:content['services']['api']['command']=['python','-c','raise SystemExit(42)']
        if socket:
            content['services']['api']['volumes']=['ll244_recovery_socket:/run/pgsocket:ro']
            content['services']['maintenance']['volumes']=['ll244_recovery_socket:/run/pgsocket:ro']
            content['volumes']={'ll244_recovery_socket':{'external':True,'name':socket}}
        override.write_text(json.dumps(content))
        return base+['-f',str(override)]
    context=ssl.create_default_context(cafile=str(ROOT/'.docker/staging-ca.crt'))
    def ready():
        deadline=time.monotonic()+60
        while time.monotonic()<deadline:
            try:
                for path,expected in [('health','ok'),('ready','ready')]:
                    with urllib.request.urlopen(stage['local_url']+'/'+path+'/',context=context,timeout=5) as response:
                        if json.load(response)!={'status':expected}:raise ValueError()
                return
            except (OSError,ValueError):time.sleep(1)
        raise RuntimeError('The local HTTPS deployment failed readiness.')
    def smoke():
        # Session is prepared separately and sent only to the local HTTPS origin.
        arguments=[__import__('sys').executable,str(ROOT/'scripts/staging_smoke.py'),'--login-configured-demo']
        if args.resolved_auth_address:arguments+=['--resolved-auth-address',args.resolved_auth_address]
        command(arguments)
    release=compose(new)
    try:
        if args.inject_failure=='migration':
            failure="from django.db import transaction,connection;exec(\"with transaction.atomic():\\n with connection.cursor() as c:c.execute('CREATE TABLE public.ll244_failed_migration(id integer)')\\n raise RuntimeError('Controlled migration failure')\")"
            command(release+['run','--rm','--no-deps','maintenance','python','manage.py','shell','-c',failure])
        command(release+['run','--rm','--no-deps','maintenance','python','manage.py','migrate','--noinput'])
        command(release+['run','--rm','--no-deps','maintenance','python','scripts/staging_runtime_role.py'])
        command(compose(new,broken=args.inject_failure=='readiness')+['up','--detach','--wait','--wait-timeout','30','--no-deps','api'])
        ready();smoke()
        if args.inject_failure:raise RuntimeError('The injected failure did not fail the candidate.')
    except Exception:
        expected_failure=False
        if args.inject_failure=='migration':expected_failure=diagnostic.exists() and 'Controlled migration failure' in diagnostic.read_text(errors='replace')
        elif args.inject_failure=='readiness':
            stopped=command(base+['ps','--all','-q','api']).strip()
            expected_failure=bool(stopped) and command(['docker','inspect','--format','{{.State.ExitCode}}',stopped]).strip()=='42'
        command(compose(old)+['up','--detach','--wait','--no-deps','api']);ready();smoke()
        check="from django.db import connection;c=connection.cursor();c.execute(\"SELECT to_regclass('public.ll244_failed_migration')\");assert c.fetchone()[0] is None"
        command(compose(old)+['run','--rm','--no-deps','maintenance','python','manage.py','shell','-c',check])
        state.update(status='recovered_expected_failure' if expected_failure else 'failed_recovered',failure=args.inject_failure,active_socket=active_socket,active_image=old)
        state_path.write_text(json.dumps(state,indent=2))
        if expected_failure:
            print('Controlled '+args.inject_failure+' failure: previous image/socket recovered, real runtime smoke passed and migration probe rolled back.',flush=True)
            return
        raise
    print('Candidate deployed; migration and runtime HTTPS smoke passed.',flush=True)
    command(compose(old)+['up','--detach','--wait','--no-deps','api']);ready();smoke()
    state['application_rollback']='passed'
    if args.skip_restore:
        command(compose(new)+['up','--detach','--wait','--no-deps','api']);ready();smoke()
        stage['image']=new
        (ROOT/'.docker/staging-state.json').write_text(json.dumps(stage,indent=2))
        state.update(status='passed',active_socket=active_socket,active_image=new,finished_utc=datetime.now(timezone.utc).isoformat())
        state_path.write_text(json.dumps(state,indent=2))
        print('Repeatable release passed; active recovery socket preserved throughout deployment and rollback.',flush=True)
        return
    state['status']='restoring';state_path.write_text(json.dumps(state,indent=2))
    suffix=uuid4().hex[:10]
    recovered='loyloop-recovery-'+suffix
    socket='loyloop-recovery-socket-'+suffix
    data='loyloop-recovery-data-'+suffix
    state.update(recovery_container=recovered,recovery_socket=socket,recovery_data=data)
    state_path.write_text(json.dumps(state,indent=2))
    command(['docker','run','--detach','--name',recovered,'--network','none',
        '--label','loyloop.purpose=ll244-isolated-recovery',
        '--env','POSTGRES_DB=loyloop_restore','--env','POSTGRES_PASSWORD_FILE=/run/secrets/staging_db_password',
        '--env','POSTGRES_INITDB_ARGS=--auth-local=scram-sha-256 --auth-host=scram-sha-256',
        '--mount','type=bind,src='+str(ROOT/'.docker/staging-db-password')+',dst=/run/secrets/staging_db_password,readonly',
        '--volume',socket+':/var/run/postgresql','--volume',data+':/var/lib/postgresql/data',PG_IMAGE])
    def pg(binary,arguments,data=None):
        return command(['docker','exec','-i',recovered,'sh','-c',
            'export PGPASSWORD="$(cat /run/secrets/staging_db_password)"; exec "$@"','sh',binary,'-U','postgres','-d','loyloop_restore',*arguments],data)
    deadline=time.monotonic()+60
    while time.monotonic()<deadline:
        result=subprocess.run(['docker','exec',recovered,'pg_isready','-U','postgres','-d','loyloop_restore'],capture_output=True)
        if result.returncode==0:break
        time.sleep(1)
    else:raise RuntimeError('The new isolated recovery database did not become ready.')
    assert command(['docker','inspect','--format','{{.HostConfig.NetworkMode}}',recovered]).strip()=='none'
    schema=command(['docker','run','--rm','--network','none','-i',PG_IMAGE,'pg_restore','--schema-only','--no-owner','--no-privileges','--file','-'],archive.read_bytes())
    roles=set()
    for group in re.findall(r'CREATE POLICY\b.*?\bTO\s+(.+?)(?:\s+USING|\s+WITH CHECK|;)',schema,re.S):
        roles.update(part.strip().strip('"') for part in group.split(','))
    bootstrap=['DROP SCHEMA public RESTRICT;','CREATE SCHEMA extensions;','CREATE EXTENSION pgcrypto WITH SCHEMA extensions;','CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;']
    bootstrap+=['CREATE ROLE "'+role.replace('"','""')+'" NOLOGIN;' for role in sorted(roles) if role.lower() not in {'public','postgres'}]
    pg('psql',['--set','ON_ERROR_STOP=1'],'\n'.join(bootstrap).encode())
    pg('pg_restore',['--no-owner','--no-privileges','--exit-on-error'],archive.read_bytes())
    q=lambda v:'"'+v.replace('"','""')+'"'
    for qualified,expected in evidence['content_sha256'].items():
        schema,table=qualified.split('.',1)
        query="SET TIME ZONE 'UTC'; SELECT encode(sha256(convert_to(coalesce(string_agg(h,'' ORDER BY h),''),'UTF8')),'hex') FROM (SELECT encode(sha256(convert_to(row_to_json(t)::text,'UTF8')),'hex') h FROM "+q(schema)+'.'+q(table)+' t) fingerprints'
        assert pg('psql',['-At','-c',query]).strip().splitlines()[-1]==expected,'Restored table content mismatch'
        assert int(pg('psql',['-At','-c','SELECT count(*) FROM '+q(schema)+'.'+q(table)]).strip())==evidence['table_counts'][qualified],'Restored table count mismatch'
    print('New no-network recovery target: all restored table counts and SHA256 fingerprints match.',flush=True)
    release=compose(new,socket)
    command(release+['run','--rm','--no-deps','maintenance','python','scripts/test_adoption.py'])
    command(release+['run','--rm','--no-deps','maintenance','python','scripts/staging_runtime_role.py'])
    command(release+['up','--detach','--wait','--no-deps','api']);ready();smoke()
    state.update(status='passed',finished_utc=datetime.now(timezone.utc).isoformat(),restore_tables=len(evidence['content_sha256']),recovered_service_smoke='passed',deployment='passed',controlled_migration='passed',active_image=new)
    state_path.write_text(json.dumps(state,indent=2))
    stage.update(image=new,recovery_socket=socket,recovery_container=recovered)
    (ROOT/'.docker/staging-state.json').write_text(json.dumps(stage,indent=2))
    print('LL-244 release/rollback/restore passed. Staging now uses the restored isolated database and candidate image; Supabase business data unchanged.')


if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('LL-244 rehearsal failed:',type(exc).__name__)
        if isinstance(exc,RuntimeError):print(str(exc))
        raise SystemExit(1) from None
