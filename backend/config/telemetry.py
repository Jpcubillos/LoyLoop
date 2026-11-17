"""Bounded request metrics and JSON spans, without URLs, bodies or credentials."""
from contextvars import ContextVar
from datetime import datetime, timezone
import hmac
import json
import logging
import os
import secrets
import time
from uuid import UUID

from django.http import HttpResponse, HttpResponseNotFound
from django.views.decorators.csrf import csrf_exempt
from prometheus_client import Counter, Histogram, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST, REGISTRY, multiprocess

tenant=ContextVar('loyloop_tenant',default=None)
trace=ContextVar('loyloop_trace',default=None)
logger=logging.getLogger('loyloop.http')
REQUESTS=Counter('loyloop_http_requests_total','Completed HTTP requests',['method','route','status'])
DURATION=Histogram('loyloop_http_duration_seconds','HTTP request duration',['method','route'],buckets=(.05,.1,.25,.5,1,2,5,10,20))


def safe_uuid(value):
    try: return str(UUID(str(value)))
    except (ValueError,TypeError,AttributeError): return None


class SafeErrorFormatter(logging.Formatter):
    def format(self,record):
        # Django's default request/error message includes the raw URL and can
        # include a claim code. Do not call getMessage() or format exceptions.
        return json.dumps({'timestamp':datetime.now(timezone.utc).isoformat(),
            'event':'http_error','level':record.levelname,'status':getattr(record,'status_code',500)},separators=(',',':'))


class TelemetryMiddleware:
    def __init__(self,get_response):
        self.get_response=get_response

    def __call__(self,request):
        reset=tenant.set(None)
        trace_id=secrets.token_hex(16)
        span_id=secrets.token_hex(8)
        trace_reset=trace.set(trace_id)
        started=time.perf_counter()
        status=500
        try:
            response=self.get_response(request)
            status=response.status_code
            response['Traceparent']='00-'+trace_id+'-'+span_id+'-01'
            return response
        finally:
            elapsed=time.perf_counter()-started
            match=getattr(request,'resolver_match',None)
            route=getattr(match,'route',None) or 'unmatched'
            method=request.method if request.method in {'GET','POST','PATCH','PUT','DELETE','OPTIONS','HEAD'} else 'OTHER'
            REQUESTS.labels(method,route,str(status)).inc()
            DURATION.labels(method,route).observe(elapsed)
            principal=getattr(request,'user',None)
            actor=safe_uuid(getattr(principal,'id',None)) if getattr(principal,'is_authenticated',False) else None
            logger.info(json.dumps({'timestamp':datetime.now(timezone.utc).isoformat(),
                'event':'http_span','trace_id':trace_id,'span_id':span_id,
                'method':method,'route':route,'status':status,'duration_ms':round(elapsed*1000,3),
                'actor_id':actor,'tenant_id':safe_uuid(tenant.get())},separators=(',',':')))
            tenant.reset(reset)
            trace.reset(trace_reset)


def metrics(request):
    secret=os.environ.get('METRICS_BEARER_TOKEN','')
    supplied=request.headers.get('Authorization','')
    if len(secret)<32 or not hmac.compare_digest(supplied.encode('utf-8'),('Bearer '+secret).encode('utf-8')):
        return HttpResponseNotFound()
    registry=REGISTRY
    if os.environ.get('PROMETHEUS_MULTIPROC_DIR'):
        registry=CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
    response=HttpResponse(generate_latest(registry),content_type=CONTENT_TYPE_LATEST)
    response['Cache-Control']='no-store'
    return response


@csrf_exempt
def alerts(request):
    secret=os.environ.get('METRICS_BEARER_TOKEN','')
    if len(secret)<32 or not hmac.compare_digest(request.headers.get('Authorization','').encode('utf-8'),('Bearer '+secret).encode('utf-8')):
        return HttpResponseNotFound()
    if request.method!='POST':
        return HttpResponse(status=405)
    try:
        if len(request.body)>65536:
            return HttpResponse(status=413)
        payload=json.loads(request.body)
        allowed={'LoyLoopReadinessDown','LoyLoopLivenessDown','LoyLoopMetricsDown',
            'LoyLoopHighErrorRate','LoyLoopHighLatency','LoyLoopBackupStale'}
        events=payload.get('alerts',[])
        if not isinstance(events,list) or len(events)>100:
            raise ValueError()
        normalized=[]
        for event in events:
            labels=event.get('labels',{})
            name=labels.get('alertname')
            severity=labels.get('severity')
            status=event.get('status')
            if name not in allowed or severity not in {'warning','critical'} or status not in {'firing','resolved'}:
                raise ValueError()
            normalized.append({'timestamp':datetime.now(timezone.utc).isoformat(),'trace_id':trace.get(),'event':'operational_alert','alert':name,'severity':severity,'status':status})
    except (ValueError,TypeError,AttributeError):
        return HttpResponse(status=400)
    for event in normalized:
        logging.getLogger('loyloop.alerts').info(json.dumps(event,separators=(',',':')))
    return HttpResponse(status=202)
