"""Never expose business writes while legacy clients can edit authorization rows."""
from django.db import connection, DatabaseError
from django.db.migrations.recorder import MigrationRecorder
from rest_framework.exceptions import APIException


class CutoverUnavailable(APIException):
    status_code=503
    default_detail='El servicio se esta actualizando. Intenta mas tarde.'


def require_cutover():
    try:
        recorder=MigrationRecorder(connection)
        if not recorder.has_table() or not recorder.migration_qs.filter(
                app='loyalty',name='0002_client_write_boundary').exists():
            raise CutoverUnavailable()
    except DatabaseError:
        raise CutoverUnavailable() from None


def require_domain():
    """Fail closed if LL domain ledgers and restrictions were not migrated."""
    require_cutover()
    try:
        if not MigrationRecorder(connection).migration_qs.filter(
                app='loyalty', name='0009_domain_services').exists():
            raise CutoverUnavailable()
    except DatabaseError:
        raise CutoverUnavailable() from None
