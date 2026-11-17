"""Controlled atomic adoption. Startup never invokes this command."""
from datetime import datetime,timezone
import hashlib
import json
import os
from pathlib import Path
import re
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand,CommandError
from django.db import connection,transaction
from loyalty.migration_ops_v1 import TABLES


def fingerprint(table,columns):
    q=connection.ops.quote_name
    projection=','.join(q(name) for name in columns)
    with connection.cursor() as cursor:
        cursor.execute("SELECT encode(sha256(convert_to(coalesce(string_agg(h,'' ORDER BY h),''),'UTF8')),'hex') FROM (SELECT encode(sha256(convert_to(row_to_json(t)::text,'UTF8')),'hex') h FROM (SELECT "+projection+' FROM public.'+q(table)+') t) fingerprints')
        return cursor.fetchone()[0]


def adopt_atomically():
    before={}
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SET LOCAL lock_timeout='10s'")
            cursor.execute("SET LOCAL statement_timeout='120s'")
            cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended('loyloop-schema-adoption',235))")
            existing=set(connection.introspection.table_names(cursor)) & TABLES
            if existing:
                cursor.execute('LOCK TABLE '+','.join('public.'+connection.ops.quote_name(t) for t in sorted(existing))+' IN ACCESS EXCLUSIVE MODE')
            cursor.execute('LOCK TABLE auth.users IN SHARE MODE')
            for table in sorted(existing):
                cursor.execute('SELECT column_name FROM information_schema.columns WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position',['public',table])
                columns=[row[0] for row in cursor.fetchall()]
                before[table]=(columns,fingerprint(table,columns))
        call_command('migrate',verbosity=0,interactive=False)
        for table,(columns,expected) in before.items():
            if fingerprint(table,columns)!=expected:
                raise RuntimeError('Existing business values changed; the entire adoption will roll back.')
    return len(before)


class Command(BaseCommand):
    help='Apply the reviewed business schema/permission cutover in one PostgreSQL transaction.'
    def add_arguments(self,parser):
        parser.add_argument('--apply',action='store_true',required=True)
        parser.add_argument('--expected-project')
        parser.add_argument('--backup-evidence',type=Path)

    def handle(self,*args,**options):
        cfg=connection.settings_dict
        isolated=(cfg['HOST'] in {'127.0.0.1','localhost','/run/pgsocket'}
            and cfg['NAME'] in {'loyloop_restore','loyloop_ll235'}
            and os.environ.get('LL235_ISOLATED_DATABASE')=='yes')
        if not isolated:
            project=options['expected_project']
            evidence_path=options['backup_evidence']
            root=Path(settings.BASE_DIR).resolve()
            if project!='phvuowulzkrttgcfnvly' or not evidence_path:
                raise CommandError('An explicit expected project and verified backup are required.')
            evidence_path=evidence_path.resolve()
            if not evidence_path.is_relative_to(root/'.docker/backups') or evidence_path.name!='evidence.json':
                raise CommandError('Use the private evidence from the authorized backup/restore procedure.')
            evidence=json.loads(evidence_path.read_text())
            archive=evidence_path.with_name('database.dump')
            stamp=datetime.strptime(evidence['timestamp_utc'].split('-')[0],'%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
            staging=json.loads((root/'.docker/staging-state.json').read_text())
            if (evidence.get('restore')!='passed' or (datetime.now(timezone.utc)-stamp).total_seconds()>600
                    or not archive.is_file() or hashlib.sha256(archive.read_bytes()).hexdigest()!=evidence['archive_sha256']
                    or staging.get('real_auth_smoke')!='passed'):
                raise CommandError('A backup restored within ten minutes and successful real-Auth staging are required.')
            if (cfg['HOST']!='aws-1-us-east-2.pooler.supabase.com'
                    or cfg['NAME']!='postgres' or cfg['USER']!='postgres.'+project
                    or cfg['OPTIONS'].get('sslmode')!='verify-full'):
                raise CommandError('The configured PostgreSQL target does not match the reviewed project and TLS mode.')
            os.environ['LL235_REMOTE_ADOPTION_PROJECT']=project
            os.environ['LL235_VERIFIED_BACKUP_SHA256']=evidence['archive_sha256']
        os.environ['LL235_ADOPT_EXISTING']='yes'
        try:
            count=adopt_atomically()
        except Exception as exc:
            # Never echo SQL DETAIL, row values or credentials.
            raise CommandError('Atomic adoption failed ('+type(exc).__name__+'); transaction rolled back.') from None
        finally:
            os.environ.pop('LL235_REMOTE_ADOPTION_PROJECT',None)
            os.environ.pop('LL235_VERIFIED_BACKUP_SHA256',None)
        self.stdout.write('Atomic business adoption committed; existing business values preserved by SHA256. Tables verified: '+str(count))
