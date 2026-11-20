import contextlib
import io
import json
from http.server import ThreadingHTTPServer
import threading
import unittest
import urllib.request
import urllib.error
from scripts.alert_receiver import Handler, normalize


class IndependentAlertTests(unittest.TestCase):
    def test_notification_drops_arbitrary_fields_and_secrets(self):
        event=normalize({'alerts':[{'labels':{'alertname':'LoyLoopLivenessDown','severity':'critical','email':'private@example.test'},'status':'firing','annotations':{'token':'private-value'}}]})[0]
        self.assertEqual(event['alert'],'LoyLoopLivenessDown')
        self.assertNotIn('private',json.dumps(event))
        self.assertEqual(set(event),{'timestamp','event','alert','severity','status'})

    def test_unknown_events_and_unbounded_batches_fail_closed(self):
        for payload in [{'alerts':[]},{'alerts':[{}]},{'alerts':[{}]*101},{'alerts':'untrusted'}]:
            with self.assertRaises((ValueError,TypeError,AttributeError)):normalize(payload)

    def test_independent_http_receiver_auth_and_safe_delivery(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        server.token='isolated-notification-token-value-only'
        worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
        output=io.StringIO()
        try:
            url='http://127.0.0.1:'+str(server.server_port)+'/alerts'
            payload=json.dumps({'alerts':[{'labels':{'alertname':'LoyLoopReadinessDown','severity':'critical'},'status':'resolved','secret':'never-log-this'}]}).encode()
            with contextlib.redirect_stdout(output):
                req=urllib.request.Request(url,data=payload,headers={'Authorization':'Bearer invalid'})
                with self.assertRaises(urllib.error.HTTPError) as caught:urllib.request.urlopen(req,timeout=3)
                self.assertEqual(caught.exception.code,404);caught.exception.close()
                self.assertEqual(output.getvalue(),'')
                req=urllib.request.Request(url,data=payload,headers={'Authorization':'Bearer '+server.token})
                with urllib.request.urlopen(req,timeout=3) as response:self.assertEqual(response.status,202)
            event=json.loads(output.getvalue())
            self.assertEqual(event['status'],'resolved')
            self.assertNotIn('never-log-this',output.getvalue())
            self.assertNotIn(server.token,output.getvalue())
        finally:
            server.shutdown();worker.join(timeout=3);server.server_close()
