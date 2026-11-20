"""Initialize a fresh, container-local multiprocess registry before Gunicorn."""
import os
from pathlib import Path

directory=Path('/tmp/loyloop-prometheus')
directory.mkdir(mode=0o700,exist_ok=True)
for file in directory.glob('*.db'):
    if file.is_file():
        file.unlink()
os.environ['PROMETHEUS_MULTIPROC_DIR']=str(directory)
os.execvp('gunicorn',['gunicorn','--config','gunicorn.conf.py','config.wsgi:application'])
