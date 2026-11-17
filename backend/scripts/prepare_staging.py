"""Restore an authorized archive into a NEW no-network Docker staging database.

The API accesses PostgreSQL through a private Unix socket volume. The database
has no network and publishes no port. Supabase receives Auth verification only.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import secrets
import subprocess
import time
import urllib.request
import ssl
from dotenv import dotenv_values

ROOT=Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--archive',type=Path,required=True)
    resume=parser.add_mutually_exclusive_group()
    resume.add_argument('--resume-empty',action='store_true')
    resume.add_argument('--resume-restored',action='store_true')
    args=parser.parse_args()
    archive=args.archive.resolve()
    if not archive.is_relative_to((ROOT/'.docker/backups').resolve()) or archive.name!='database.dump':
        raise RuntimeError('Only an existing private authorized backup archive is accepted.')
    evidence=json.loads(archive.with_name('evidence.json').read_text())
    if evidence.get('restore')!='passed' or hashlib.sha256(archive.read_bytes()).hexdigest()!=evidence['archive_sha256']:
        raise RuntimeError('The archive must match a previously verified restore.')
    state_path=ROOT/'.docker/staging-state.json'
    previous=json.loads(state_path.read_text()) if state_path.exists() else None
    resuming=args.resume_empty or args.resume_restored
    if previous and not resuming:
        raise RuntimeError('Staging state already exists. Review the existing deployment before creating another.')
    env_path=ROOT/'.docker/staging.env'
    password_path=ROOT/'.docker/staging-db-password'
    if (env_path.exists() or password_path.exists()) and not (previous and resuming):
        raise RuntimeError('Existing staging credentials must be reviewed; they will not be overwritten.')
    web=dotenv_values(ROOT.parent/'.env.local',interpolate=False)
    auth_url=web['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/')
    if auth_url!='https://phvuowulzkrttgcfnvly.supabase.co':
        raise RuntimeError('Unexpected Auth project.')
    db_password=password_path.read_text() if previous else secrets.token_urlsafe(48)
    values={
        'DJANGO_SECRET_KEY':secrets.token_urlsafe(64),
        'DJANGO_ALLOWED_HOSTS':'localhost,127.0.0.1',
        'DJANGO_TRUST_PROXY_SSL_HEADER':'true',
        'DJANGO_SECURE_SSL_REDIRECT':'true',
        'LL235_ISOLATED_DATABASE':'yes','LL235_STAGING_REHEARSAL':'yes',
        'DB_PASSWORD':db_password,'SUPABASE_AUTH_URL':auth_url+'/auth/v1',
        'SUPABASE_PUBLISHABLE_KEY':web['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
        'METRICS_BEARER_TOKEN':secrets.token_urlsafe(48),
    }
    if not previous:
        env_path.write_text('\n'.join(k+'='+v for k,v in values.items())+'\n')
        password_path.write_text(db_password)
    elif (previous.get('status') not in {'restoring','restored'} or previous.get('archive_sha256')!=evidence['archive_sha256']
            or dotenv_values(env_path,interpolate=False).get('DB_PASSWORD')!=db_password):
        raise RuntimeError('The recorded staging restore cannot be resumed safely.')
    env_path.chmod(0o600);password_path.chmod(0o600)
    ca=ROOT/'.docker/staging-ca.crt'
    ca.touch(exist_ok=True)
    project=previous['project'] if previous else 'loyloop-stage-'+secrets.token_hex(4)
    if not re.fullmatch('loyloop-stage-[a-f0-9]{8}',project):
        raise RuntimeError('Unexpected staging project identity.')
    compose=['compose','--env-file',str(ROOT/'docker/compose.env'),
        '--project-name',project,'-f',str(ROOT/'compose.staging.yaml')]
    diagnostic=ROOT/'.docker/staging-private-diagnostic.log'

    def docker(arguments,data=None):
        result=subprocess.run(['docker',*arguments],cwd=ROOT,input=data,capture_output=True)
        if result.returncode:
            diagnostic.write_bytes(result.stdout+result.stderr)
            raise RuntimeError('Docker staging operation failed; private diagnostic saved.')
        return result.stdout

    docker(['build','--tag','loyloop-django:staging',str(ROOT)])
    docker(compose+['up','--detach','--wait','database'])
    database=docker(compose+['ps','-q','database']).decode().strip()
    # Record the generated target immediately; never silently abandon a restore.
    state={'project':project,'database_container':database,'archive_sha256':evidence['archive_sha256'],
        'timestamp_utc':datetime.now(timezone.utc).isoformat(),'status':'restoring'}
    state_path.write_text(json.dumps(state,indent=2))
    if docker(['inspect','--format','{{.HostConfig.NetworkMode}}',database]).decode().strip()!='none':
        raise RuntimeError('The restored database must have network mode none.')
    schema=docker(['run','--rm','--network','none','-i','postgres:17@sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac',
        'pg_restore','--schema-only','--no-owner','--no-privileges','--file','-'],archive.read_bytes()).decode()
    roles=set()
    for group in re.findall(r'CREATE POLICY\b.*?\bTO\s+(.+?)(?:\s+USING|\s+WITH CHECK|;)',schema,re.S):
        roles.update(part.strip().strip('"') for part in group.split(','))
    bootstrap=['DROP SCHEMA public RESTRICT;','CREATE SCHEMA extensions;',
        'CREATE EXTENSION pgcrypto WITH SCHEMA extensions;',
        'CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;']
    bootstrap+=['CREATE ROLE "'+role.replace('"','""')+'" NOLOGIN;' for role in sorted(roles) if role.lower() not in {'public','postgres'}]

    def database_command(binary,arguments,data=None):
        # Fixed Linux command; the secret is read inside this isolated container.
        return docker(['exec','-i',database,'sh','-c',
            'export PGPASSWORD="$(cat /run/secrets/staging_db_password)"; exec "$@"',
            'sh',binary,'-U','postgres','-d','loyloop_restore',*arguments],data)

    if previous and args.resume_empty:
        count=database_command('psql',['-At','-c',"SELECT count(*) FROM pg_tables WHERE schemaname IN ('public','auth','storage')"]).decode().strip()
        if count!='0':
            raise RuntimeError('Resume is only allowed for a verified empty staging target.')
    if args.resume_restored:
        # Do not rerun pg_restore over existing data. Resume only an exact copy
        # of the authorized snapshot, before any adoption/migration ran.
        for qualified,expected in evidence['content_sha256'].items():
            schema,table=qualified.split('.',1)
            q=lambda value:'"'+value.replace('"','""')+'"'
            query="SET TIME ZONE 'UTC'; SELECT encode(sha256(convert_to(coalesce(string_agg(h, '' ORDER BY h), ''), 'UTF8')), 'hex') FROM (SELECT encode(sha256(convert_to(row_to_json(t)::text, 'UTF8')), 'hex') h FROM "+q(schema)+'.'+q(table)+' t) fingerprints'
            actual=database_command('psql',['-At','-c',query]).decode().strip().splitlines()[-1]
            if actual!=expected:
                raise RuntimeError('Restored snapshot values differ; automatic resume is not permitted.')
    else:
        database_command('psql',['--set','ON_ERROR_STOP=1'],'\n'.join(bootstrap).encode())
        database_command('pg_restore',['--no-owner','--no-privileges','--exit-on-error'],archive.read_bytes())
    state['status']='restored'
    state_path.write_text(json.dumps(state,indent=2))
    output=docker(compose+['run','--rm','--no-deps','api','python','scripts/test_adoption.py'])
    if b'Restored-copy adoption:' not in output:
        raise RuntimeError('Adoption did not report success.')
    state['adoption']='passed';state['status']='starting'
    state_path.write_text(json.dumps(state,indent=2))
    docker(compose+['up','--detach','--wait','api','proxy'])
    docker(compose+['cp','proxy:/data/caddy/pki/authorities/local/root.crt',str(ca)])
    context=ssl.create_default_context(cafile=str(ca))
    for path,status in [('health','ok'),('ready','ready')]:
        with urllib.request.urlopen('https://localhost:8444/'+path+'/',context=context,timeout=15) as response:
            if response.status!=200 or json.load(response)!={'status':status}:
                raise RuntimeError('Staging HTTPS verification failed.')
    image=docker(['image','inspect','--format','{{.Id}}','loyloop-django:staging']).decode().strip()
    state.update(status='ready',image=image,local_url='https://localhost:8444')
    state_path.write_text(json.dumps(state,indent=2))
    print('Isolated restored-copy staging: adoption/data-preservation checks passed; HTTPS health and readiness 200.')
    print('Database network: none; no database/API host port. Supabase business data was not modified.')


if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('Staging preparation failed ('+type(exc).__name__+'). Review private state/diagnostic; no remote restore was requested.')
        raise SystemExit(1) from None
