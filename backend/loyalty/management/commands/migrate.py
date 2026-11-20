"""Reject fake adoption and destructive backward plans before applying any SQL."""
from django.core.management.base import CommandError
from django.core.management.commands.migrate import Command as DjangoMigrate
from django.db import connections
from django.db.migrations.executor import MigrationExecutor
from loyalty.migration_ops_v1 import initialized_adoption


class Command(DjangoMigrate):
    def handle(self,*args,**options):
        label=options.get('app_label')
        if label in (None,'loyalty') and (options.get('fake') or options.get('fake_initial')):
            raise CommandError('Business adoption must run its checks; fake migrations are not permitted.')
        connection=connections[options.get('database','default')]
        name=options.get('migration_name')
        if connection.vendor=='postgresql' and label=='loyalty' and name and initialized_adoption(type('Editor',(),{'connection':connection})()):
            executor=MigrationExecutor(connection)
            target=None if name=='zero' else executor.loader.get_migration_by_prefix('loyalty',name).name
            plan=executor.migration_plan([('loyalty',target)])
            if any(backwards for _,backwards in plan) and not options.get('plan'):
                raise CommandError('Adopted legacy data cannot be rolled back by dropping schema; use a reviewed forward fix or restore.')
        return super().handle(*args,**options)
