"""Reproducible Docker commands; never interpolate the private .env in Compose."""
import argparse
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ['docker', 'compose', '--env-file', str(ROOT/'docker/compose.env'), '-f', str(ROOT/'compose.yaml')]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['up', 'down', 'ps', 'logs', 'check', 'database-check', 'pool-check'])
    args = parser.parse_args()
    if args.action == 'up':
        subprocess.run([sys.executable, str(ROOT/'scripts/setup_docker.py')], check=True)
        command = ['up', '--build', '--detach', '--wait', '--wait-timeout', '120']
    elif args.action == 'down':
        command = ['down', '--remove-orphans']  # Includes optional tunnel; retains certificate/data volumes.
    elif args.action == 'logs':
        command = ['logs', '--tail', '60']
    elif args.action == 'database-check':
        command = ['exec', '-T', 'api', 'python', 'scripts/check_database.py']
    elif args.action == 'pool-check':
        command = ['exec', '-T', 'api', 'python', 'scripts/probe_pool.py']
    elif args.action == 'check':
        subprocess.run([sys.executable, str(ROOT/'scripts/docker_smoke.py')], check=True)
        return
    else:
        command = ['ps']
    subprocess.run(COMPOSE + command, cwd=ROOT, check=True)


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as exc:
        raise SystemExit(exc.returncode) from None
    except OSError:
        raise SystemExit('Docker command failed; check Docker Desktop and local service status.') from None
