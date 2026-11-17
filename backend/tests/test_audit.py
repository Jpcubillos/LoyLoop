import json
import unittest
from unittest.mock import patch
from uuid import uuid4

from config.audit import record_event


class AuditTests(unittest.TestCase):
    def test_event_contains_only_contract_fields(self):
        actor, tenant = uuid4(), uuid4()
        with self.assertLogs("loyloop.audit", level="INFO") as captured:
            record_event(event="business_action", outcome="success", actor_id=actor, tenant_id=tenant)
        event = json.loads(captured.records[0].getMessage())
        self.assertTrue(event.pop("timestamp").endswith("+00:00"))
        self.assertEqual(event, {"event": "business_action", "outcome": "success",
                                 "actor_id": str(actor), "tenant_id": str(tenant)})

    def test_untrusted_values_and_secrets_are_rejected(self):
        actor, tenant = uuid4(), uuid4()
        for override in ({"actor_id": "Bearer secret"}, {"tenant_id": "token"},
                         {"event": "password"}, {"outcome": "secret"}):
            values = {"event": "business_action", "outcome": "success",
                      "actor_id": actor, "tenant_id": tenant}
            values.update(override)
            with self.subTest(override=override), patch("config.audit.logger.info") as log:
                with self.assertRaises(ValueError):
                    record_event(**values)
                log.assert_not_called()
