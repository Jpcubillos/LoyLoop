FROM python:3.12-slim@sha256:05a994d2344eb364cc186910f4fc8786a38215f39f00d0acc25bff33a08f4177

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt requirements-docker.txt ./
RUN pip install --no-cache-dir -r requirements-docker.txt && pip check \
    && groupadd --gid 10001 loyloop \
    && useradd --uid 10001 --gid loyloop --no-create-home loyloop
COPY --chown=10001:10001 config ./config
COPY --chown=10001:10001 loyalty ./loyalty
COPY --chown=10001:10001 scripts ./scripts
COPY --chown=10001:10001 tests ./tests
COPY --chown=10001:10001 manage.py gunicorn.conf.py ./
USER 10001:10001
EXPOSE 8000
CMD ["python", "scripts/start_api.py"]
