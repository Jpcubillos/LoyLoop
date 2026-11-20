"""Rehearse complete rollback and commit against the no-network restored copy."""
import os
from pathlib import Path
import secrets
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['DJANGO_SETTINGS_MODULE']='config.settings.restore_ci'
os.environ['LL235_ADOPT_EXISTING']='yes'
os.environ.setdefault('DJANGO_SECRET_KEY',secrets.token_urlsafe(64))
import django
django.setup()
from django.db import connection,transaction
from django.db.migrations.executor import MigrationExecutor
from loyalty.migration_ops_v1 import TABLES
from loyalty.management.commands.adopt_business_schema import adopt_atomically,fingerprint


class RehearsalRollback(Exception):pass


def main():
    if connection.settings_dict['HOST']!='127.0.0.1' or connection.settings_dict['NAME']!='loyloop_restore':
        raise RuntimeError('Only the isolated restored copy is permitted.')
    before={}
    with connection.cursor() as cursor:
        for table in sorted(TABLES):
            cursor.execute('SELECT column_name FROM information_schema.columns WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position',['public',table])
            columns=[row[0] for row in cursor.fetchall()]
            if columns:before[table]=(columns,fingerprint(table,columns))
    try:
        with transaction.atomic():
            adopt_atomically()
            raise RehearsalRollback()
    except RehearsalRollback:pass
    with connection.cursor() as cursor:
        cursor.execute("SELECT to_regclass('public.django_migrations'),to_regclass('public.loyloop_schema_adoptions')")
        assert cursor.fetchone()==(None,None),'Metadata escaped the rollback'
    for table,(columns,expected) in before.items():
        assert fingerprint(table,columns)==expected,'Legacy data escaped the rollback'
    adopt_atomically()
    for table,(columns,expected) in before.items():
        assert fingerprint(table,columns)==expected,'Legacy data changed after commit'
    executor=MigrationExecutor(connection)
    assert not executor.migration_plan(executor.loader.graph.leaf_nodes())
    print('Atomic restored-copy adoption passed: complete schema/ACL/metadata rollback, then commit, legacy business SHA256 preserved and no pending migrations.')


if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('Atomic adoption rehearsal failed:',type(exc).__name__)
        raise SystemExit(1) from None
    finally:
        connection.close();connection.close_pool()
