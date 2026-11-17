"""Logical backup and isolated restore; never restores into the source database."""
import argparse
import os
import ipaddress
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import uuid
import time

from dotenv import dotenv_values
import psycopg
from psycopg import sql

DIAGNOSTIC = None


def docker(args, *, input=None, output=None):
    result = subprocess.run(['docker', *args], input=input, stdout=output or subprocess.PIPE,
                            stderr=subprocess.PIPE)
    if result.returncode:
        if DIAGNOSTIC is not None:
            DIAGNOSTIC.write_bytes(result.stderr)
        # PostgreSQL diagnostics can contain values from rows; never echo them.
        raise RuntimeError('Docker/PostgreSQL operation failed; private diagnostic captured')
    return result.stdout


def main():
    global DIAGNOSTIC
    parser = argparse.ArgumentParser()
    parser.add_argument('--backend-dir', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--restore-isolated', action='store_true', required=True)
    args = parser.parse_args()
    root = args.backend_dir.resolve()
    env = dotenv_values(root/'.env', interpolate=False)
    certificate = root/'supabase-ca.crt'
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:6]
    directory = root/'.docker/backups'/stamp
    directory.mkdir(parents=True, exist_ok=False)
    DIAGNOSTIC = directory/'private-diagnostic.log'
    passfile = directory/'temporary.pgpass'
    archive = directory/'database.dump'
    container = 'loyloop-restore-'+stamp.lower()
    source_connection = None
    created = False
    try:
        params = {name: env[key] for name,key in [('host','DB_HOST'),('port','DB_PORT'),('dbname','DB_NAME'),('user','DB_USER'),('password','DB_PASSWORD')]}
        for attempt in range(3):
            try:
                source_connection = psycopg.connect(**params, sslmode='verify-full', sslrootcert=str(certificate),
                                                     connect_timeout=10, prepare_threshold=None)
                break
            except psycopg.OperationalError as exc:
                if attempt == 2 or getattr(exc, 'sqlstate', '') in {'28P01','28000'}:
                    raise
                time.sleep(0.5 * (2**attempt))
        source_connection.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
        snapshot = source_connection.execute('SELECT pg_export_snapshot()').fetchone()[0]
        tables = source_connection.execute("SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('public','auth','storage') ORDER BY 1,2").fetchall()
        counts = {}
        fingerprints = {}
        def fingerprint_query(schema, table):
            return sql.SQL("SELECT encode(sha256(convert_to(coalesce(string_agg(h, '' ORDER BY h), ''), 'UTF8')), 'hex') FROM (SELECT encode(sha256(convert_to(row_to_json(t)::text, 'UTF8')), 'hex') AS h FROM {}.{} AS t) AS fingerprints").format(sql.Identifier(schema), sql.Identifier(table))
        source_connection.execute("SET LOCAL TIME ZONE 'UTC'")
        for schema,table in tables:
            counts[schema+'.'+table] = source_connection.execute(sql.SQL('SELECT count(*) FROM {}.{}').format(sql.Identifier(schema),sql.Identifier(table))).fetchone()[0]
            fingerprints[schema+'.'+table] = source_connection.execute(fingerprint_query(schema,table)).fetchone()[0]
        roles = [row[0] for row in source_connection.execute("SELECT DISTINCT unnest(roles)::text FROM pg_policies WHERE schemaname IN ('public','auth','storage')")]
        version = source_connection.execute('SHOW server_version_num').fetchone()[0]
        fields = [params[name] for name in ('host','port','dbname','user','password')]
        if any('\n' in value or '\r' in value for value in fields):
            raise ValueError('Multiline libpq credentials require a different secret transport')
        passfile.write_text(':'.join(value.replace('\\','\\\\').replace(':','\\:') for value in fields)+'\n', encoding='utf-8')
        passfile.chmod(0o600)
        if os.environ.get('PGHOSTADDR'): ipaddress.ip_address(os.environ['PGHOSTADDR'])
        with archive.open('wb') as output:
            docker(['run','--rm',*(['--env','PGHOSTADDR'] if os.environ.get('PGHOSTADDR') else []),'--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=32m',
                    '--mount',f'type=bind,src={passfile},dst=/run/secrets/pgpass,readonly',
                    '--mount',f'type=bind,src={certificate},dst=/run/secrets/ca.crt,readonly',
                    '--env','PGSSLMODE=verify-full','--env','PGSSLROOTCERT=/run/secrets/ca.crt',
                    '--entrypoint','sh','postgres:17','-c',
                    'umask 077; cp /run/secrets/pgpass /tmp/pgpass; export PGPASSFILE=/tmp/pgpass; exec "$@"',
                    'sh','pg_dump','--host',params['host'],'--port',params['port'],'--username',params['user'],
                    '--dbname',params['dbname'],'--format=custom','--no-owner','--no-privileges',
                    '--schema=public','--schema=auth','--schema=storage','--snapshot',snapshot], output=output)
        source_connection.rollback()
        source_connection.close()
        source_connection = None
        passfile.unlink()
        docker(['run','--detach','--name',container,'--network','none',
                '--env','POSTGRES_PASSWORD=restore-isolated-only',
                '--env','POSTGRES_DB=loyloop_restore',
                '--health-cmd','pg_isready -U postgres -d loyloop_restore',
                '--health-interval','1s','--health-timeout','5s','--health-retries','30','postgres:17'])
        created = True
        # Bounded readiness wait, no arbitrary fixed delay.
        deadline = time.monotonic()+60
        while time.monotonic()<deadline:
            state = docker(['inspect','--format','{{.State.Health.Status}}',container]).decode().strip()
            if state=='healthy':
                break
            if state=='unhealthy':
                raise RuntimeError('Isolated PostgreSQL unhealthy')
            time.sleep(0.5)
        else:
            raise RuntimeError('Isolated PostgreSQL did not start')
        # This database was just created in our generated no-network container.
        # pg_dump includes CREATE SCHEMA public, while initdb created an empty
        # public schema already. RESTRICT intentionally fails if it isn't empty.
        bootstrap = ['DROP SCHEMA public RESTRICT;', 'CREATE SCHEMA IF NOT EXISTS extensions;',
                     'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;',
                     'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;']
        for role in sorted(set(roles)):
            if role.lower() not in ('public','postgres'):
                bootstrap.append('CREATE ROLE "'+role.replace('"','""')+'" NOLOGIN;')
        docker(['exec','-i',container,'psql','-U','postgres','-d','loyloop_restore','--set','ON_ERROR_STOP=1'],input='\n'.join(bootstrap).encode())
        # Restore reads archive bytes over stdin. No network or source credentials
        # are available to the restore target.
        docker(['exec','-i',container,'pg_restore','-U','postgres','-d','loyloop_restore',
                '--no-owner','--no-privileges','--exit-on-error'], input=archive.read_bytes())
        restored = {}
        restored_fingerprints = {}
        for schema,table in tables:
            query = 'SELECT count(*) FROM "'+schema.replace('"','""')+'"."'+table.replace('"','""')+'";'
            restored[schema+'.'+table] = int(docker(['exec',container,'psql','-U','postgres','-d','loyloop_restore','-At','-c',query]).decode().strip())
            # Compose with psycopg quoting; this never sends row values to stdout.
            query = "SET TIME ZONE 'UTC'; " + fingerprint_query(schema,table).as_string()
            result = docker(['exec',container,'psql','-U','postgres','-d','loyloop_restore','-At','-c',query]).decode().strip().splitlines()
            restored_fingerprints[schema+'.'+table] = result[-1]
        if counts != restored:
            raise RuntimeError('Restored table counts differ from source snapshot')
        if fingerprints != restored_fingerprints:
            raise RuntimeError('Restored content fingerprints differ from source snapshot')
        report = {'timestamp_utc':stamp, 'source_version':version,
                  'scope':['public','auth','storage'], 'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
                  'table_counts':counts, 'restored_table_counts':restored,
                  'content_sha256':fingerprints, 'restored_content_sha256':restored_fingerprints,
                  'isolated_network':'none', 'restore':'passed',
                  'excluded':['Storage object binaries','project configuration','global roles/privileges','schemas outside selected scope']}
        (directory/'evidence.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print('Consistent logical backup and network-isolated restore passed (counts and content SHA256). Tables verified:',len(tables))
        print('Private artifact directory:',directory)
    finally:
        if source_connection is not None:
            source_connection.rollback()
            source_connection.close()
        if passfile.exists():
            passfile.unlink()
        if created:
            subprocess.run(['docker','stop',container],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)


if __name__=='__main__':
    try:
        main()
    except Exception as exc:
        print('Backup/restore failed ('+type(exc).__name__+'). Source database was not modified.')
        raise SystemExit(1) from None
