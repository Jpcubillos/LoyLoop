import unittest
from test_bootstrap import KEY,run_python


class TelemetryTests(unittest.TestCase):
    def test_safe_spans_metrics_and_error_logs(self):
        result=run_python(['-c','''
import django;django.setup()
import json,logging,os
from unittest.mock import patch
from django.test import Client
from config.telemetry import SafeErrorFormatter
client=Client(HTTP_HOST='localhost')
with patch('config.telemetry.logger.info') as log:
    response=client.get('/health/?token=private-marker',HTTP_AUTHORIZATION='Bearer private-marker')
    assert response.status_code==200 and len(response['Traceparent'])==55
    event=json.loads(log.call_args.args[0])
    assert event['route']=='health/' and event['actor_id'] is None
    assert 'private-marker' not in str(event)
record=logging.LogRecord('django.request',logging.ERROR,'',0,'Bad request /claim-requests/private-marker/',(),None)
assert 'private-marker' not in SafeErrorFormatter().format(record)
assert client.get('/internal/metrics/').status_code==404
os.environ['METRICS_BEARER_TOKEN']='isolated-metrics-token-with-at-least-32-characters'
assert client.get('/internal/metrics/',HTTP_AUTHORIZATION='Bearer invalid').status_code==404
metrics=client.get('/internal/metrics/',HTTP_AUTHORIZATION='Bearer '+os.environ['METRICS_BEARER_TOKEN'])
assert metrics.status_code==200
data=metrics.content.decode()
assert 'loyloop_http_requests_total' in data and 'loyloop_http_duration_seconds_bucket' in data
assert 'private-marker' not in data and os.environ['METRICS_BEARER_TOKEN'] not in data
assert client.post('/internal/alerts/',data='{}',content_type='application/json').status_code==404
with patch('logging.Logger.info') as log:
    alert=client.post('/internal/alerts/',data=json.dumps({'alerts':[{'status':'firing','labels':{'alertname':'LoyLoopReadinessDown','severity':'critical','password':'private-marker'}}]}),content_type='application/json',HTTP_AUTHORIZATION='Bearer '+os.environ['METRICS_BEARER_TOKEN'])
    assert alert.status_code==202
    assert 'private-marker' not in str(log.call_args_list)
    assert any('operational_alert' in str(call) for call in log.call_args_list)

'''],variables={'DJANGO_SECRET_KEY':KEY})
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertNotIn('private-marker',result.stdout+result.stderr)
