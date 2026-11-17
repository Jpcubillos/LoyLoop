import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from django.core.exceptions import ImproperlyConfigured
from config.database import postgres_database


class DatabaseConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.env = {"DB_HOST": "pool.example.org", "DB_NAME": "postgres",
                    "DB_USER": "backend", "DB_PASSWORD": "test-only-secret",
                    "DB_SSLMODE": "require"}

    def test_missing_credentials_fail_without_leaking(self):
        for key in ("DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"):
            env = self.env.copy()
            env.pop(key)
            with self.subTest(key=key), patch.dict(os.environ, env, clear=True):
                with self.assertRaises(ImproperlyConfigured) as caught:
                    postgres_database()
                self.assertNotIn("test-only-secret", str(caught.exception))

    def test_verified_tls_requires_trust_file(self):
        with patch.dict(os.environ, {**self.env, "DB_SSLMODE": "verify-full"}, clear=True):
            with self.assertRaises(ImproperlyConfigured):
                postgres_database()
        with tempfile.TemporaryDirectory() as directory:
            cert = Path(directory) / "ca.crt"
            cert.write_text("fixture path only; no network")
            with patch.dict(os.environ, {**self.env, "DB_SSLMODE": "verify-full", "DB_SSLROOTCERT": str(cert)}, clear=True):
                self.assertEqual(postgres_database()["OPTIONS"]["sslmode"], "verify-full")

    def test_pool_is_bounded_and_transaction_mode_disables_session_features(self):
        with patch.dict(os.environ, {**self.env, "DB_POOL_MODE": "transaction"}, clear=True):
            db = postgres_database()
        self.assertEqual(db["CONN_MAX_AGE"], 0)
        self.assertTrue(db["DISABLE_SERVER_SIDE_CURSORS"])
        self.assertIsNone(db["OPTIONS"]["prepare_threshold"])
        self.assertEqual(db["OPTIONS"]["pool"]["max_size"], 5)

    def test_unsafe_and_unbounded_settings_rejected(self):
        for key, value in (("DB_SSLMODE", "disable"), ("DB_POOL_MAX_SIZE", "0"),
                           ("DB_POOL_MAX_SIZE", "1000"), ("DB_PORT", "no"),
                           ("DB_CONNECT_TIMEOUT", "0"), ("DB_POOL_MODE", "unknown")):
            with self.subTest(key=key), patch.dict(os.environ, {**self.env, key: value}, clear=True):
                with self.assertRaises(ImproperlyConfigured):
                    postgres_database()
