import unittest
from test_bootstrap import KEY, run_python


class ReadinessTests(unittest.TestCase):
    def test_ready_pending_and_database_failure_are_distinct_from_liveness(self):
        script = '''
import django; django.setup()
from unittest.mock import patch, MagicMock
from django.test import Client
client = Client(HTTP_HOST='localhost')
with patch('config.readiness.connection') as connection, patch('config.readiness.MigrationExecutor') as executor:
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchone.return_value = (1,)
    executor.return_value.migration_plan.return_value = []
    response = client.get('/ready/')
    assert response.status_code == 200 and response.json() == {'status': 'ready'}
    assert 'no-store' in response['Cache-Control']
    executor.return_value.migration_plan.return_value = ['pending']
    assert client.get('/ready/').status_code == 503
    connection.cursor.side_effect = RuntimeError('password=never-output-this')
    response = client.get('/ready/')
    assert response.status_code == 503 and response.json() == {'status':'not_ready'}
    assert client.get('/health/').status_code == 200
assert client.post('/ready/').status_code == 405
'''
        result = run_python(['-c', script], variables={'DJANGO_SECRET_KEY': KEY})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('never-output-this', result.stderr)
        self.assertNotIn('never-output-this', result.stdout)
