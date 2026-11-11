"""Start a real local Django HTTP process with a disposable secret and probe it."""
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def main():
    env = {k: v for k, v in os.environ.items() if not k.startswith("DJANGO_")}
    env.update({
        "DJANGO_SETTINGS_MODULE": "config.settings.local",
        "DJANGO_SECRET_KEY": secrets.token_urlsafe(64),
        "DJANGO_ALLOWED_HOSTS": "127.0.0.1,localhost",
        "PYTHONUNBUFFERED": "1",
    })
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    process = subprocess.Popen(
        [sys.executable, "manage.py", "runserver", f"127.0.0.1:{port}", "--noreload"],
        cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
    )
    try:
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError("Django exited before the healthcheck started: " + process.stderr.read())
            try:
                with urlopen(f"http://127.0.0.1:{port}/health/", timeout=1) as response:
                    if response.status != 200 or json.load(response) != {"status": "ok"}:
                        raise RuntimeError("Unexpected health response")
                    print("Local HTTP startup and /health/: OK")
                    return
            except URLError:
                time.sleep(0.1)  # Poll until the server is listening, up to the deadline.
        raise RuntimeError("Timed out waiting for the local healthcheck.")
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        if process.stderr:
            process.stderr.close()


if __name__ == "__main__":
    main()
