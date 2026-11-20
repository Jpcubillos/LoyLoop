"""Independent local staging alert sink; never logs arbitrary notification data."""
from datetime import datetime, timezone
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path

ALERTS={'LoyLoopReadinessDown','LoyLoopLivenessDown','LoyLoopMetricsDown','LoyLoopHighErrorRate','LoyLoopHighLatency','LoyLoopBackupStale'}


def normalize(payload):
    rows=payload.get('alerts',[])
    if not isinstance(rows,list) or not rows or len(rows)>100:raise ValueError()
    result=[]
    for row in rows:
        labels=row.get('labels',{})
        name,severity,status=labels.get('alertname'),labels.get('severity'),row.get('status')
        if name not in ALERTS or severity not in {'warning','critical'} or status not in {'firing','resolved'}:raise ValueError()
        result.append({'timestamp':datetime.now(timezone.utc).isoformat(),'event':'operational_alert','alert':name,'severity':severity,'status':status})
    return result


class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_POST(self):
        supplied=self.headers.get('Authorization','').encode()
        expected=('Bearer '+self.server.token).encode()
        if self.path!='/alerts' or not hmac.compare_digest(supplied,expected):
            self.send_error(404);return
        try:
            length=int(self.headers.get('Content-Length','0'))
            if length<=0 or length>65536:raise ValueError()
            events=normalize(json.loads(self.rfile.read(length)))
        except (ValueError,TypeError,AttributeError):
            self.send_error(400);return
        for event in events:print(json.dumps(event,separators=(',',':')),flush=True)
        self.send_response(202);self.send_header('Content-Length','0');self.end_headers()


if __name__=='__main__':
    token=Path('/run/secrets/metrics_token').read_text()
    if len(token)<32:raise SystemExit('Private notification secret is required.')
    server=ThreadingHTTPServer(('0.0.0.0',9099),Handler)
    server.daemon_threads=True;server.token=token
    server.serve_forever()
