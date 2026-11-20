"""Explicit process and connection budgets; pools are created after fork."""
bind = "0.0.0.0:8000"
workers = 2
worker_class = "gthread"
threads = 2
timeout = 30
graceful_timeout = 30
keepalive = 5
preload_app = False
accesslog = None  # Avoid raw URLs, query strings, tokens or personal data.
errorlog = "-"
loglevel = "info"
max_requests = 2000
max_requests_jitter = 200
forwarded_allow_ips = ""  # Django trusts only the private proxy's rewritten header.


def child_exit(server, worker):
    from prometheus_client import multiprocess
    multiprocess.mark_process_dead(worker.pid)
