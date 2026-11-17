"""Minimal audit event contract; never accepts request bodies or arbitrary metadata."""
import json
import logging
from datetime import datetime, timezone
from uuid import UUID
from .telemetry import trace

logger = logging.getLogger("loyloop.audit")
EVENTS = frozenset({"access_denied", "business_action"})
OUTCOMES = frozenset({"success", "denied", "failure"})


def record_event(*, event, outcome, actor_id, tenant_id):
    """Record identifiers only after caller has independently authenticated them."""
    if event not in EVENTS or outcome not in OUTCOMES:
        raise ValueError("Unsupported audit event or outcome")
    # Canonical UUIDs prevent accidentally emitting credentials or user data.
    actor = str(UUID(str(actor_id)))
    tenant = str(UUID(str(tenant_id)))
    logger.info(json.dumps({"timestamp": datetime.now(timezone.utc).isoformat(),
                            "event": event, "outcome": outcome,
                            "actor_id": actor, "tenant_id": tenant, **({"trace_id":trace.get()} if trace.get() else {})}, separators=(",", ":")))
