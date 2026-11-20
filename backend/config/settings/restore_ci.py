"""No-network Docker restore target only. Never loads backend/.env."""
from .postgres_ci import *  # noqa: F403

DATABASES['default']['NAME']='loyloop_restore'
