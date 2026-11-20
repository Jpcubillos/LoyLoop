"""Readiness is stricter than liveness: connectivity and migration state."""
import logging
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET

logger = logging.getLogger('loyloop.readiness')


@never_cache
@require_GET
def ready(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            if cursor.fetchone() != (1,):
                return JsonResponse({'status': 'not_ready'}, status=503)
        executor = MigrationExecutor(connection)
        if executor.migration_plan(executor.loader.graph.leaf_nodes()):
            return JsonResponse({'status': 'not_ready'}, status=503)
    except Exception:
        # Driver tracebacks may contain credentials; public response stays generic.
        logger.warning('Database readiness check failed')
        return JsonResponse({'status': 'not_ready'}, status=503)
    return JsonResponse({'status': 'ready'})
