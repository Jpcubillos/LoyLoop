from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from dotenv import dotenv_values

SCRIPT = Path(__file__).resolve().parents[1]/'scripts/setup_docker.py'


class DockerSecretSetupTests(unittest.TestCase):
    def make_root(self, directory, extra=''):
        root=Path(directory)
        (root/'scripts').mkdir()
        shutil.copy2(SCRIPT, root/'scripts/setup_docker.py')
        (root/'supabase-ca.crt').write_text('test path only; no connection attempted')
        # Literal dollar signs and hash characters must survive secret parsing.
        (root/'.env').write_text('DB_HOST=example.invalid\nDB_PORT=5432\nDB_NAME=test\nDB_USER=test\nDB_PASSWORD="test-$literal-#-password"\n'+extra)
        return root

    def run_setup(self, root):
        return subprocess.run([sys.executable, str(root/'scripts/setup_docker.py')],capture_output=True,text=True)

    def test_initializes_once_preserving_password_and_key(self):
        with tempfile.TemporaryDirectory() as directory:
            root=self.make_root(directory)
            first=self.run_setup(root)
            self.assertEqual(first.returncode,0,first.stderr)
            values=dotenv_values(root/'.env',interpolate=False)
            self.assertGreaterEqual(len(values['DJANGO_SECRET_KEY']),50)
            self.assertEqual(values['DB_PASSWORD'],'test-$literal-#-password')
            before=(root/'.env').read_bytes()
            second=self.run_setup(root)
            self.assertEqual(second.returncode,0,second.stderr)
            self.assertEqual((root/'.env').read_bytes(),before)
            self.assertNotIn(values['DJANGO_SECRET_KEY'],first.stdout+first.stderr+second.stdout+second.stderr)
            self.assertNotIn(values['DB_PASSWORD'],first.stdout+first.stderr+second.stdout+second.stderr)

    def test_refuses_invalid_existing_key_without_overwriting(self):
        with tempfile.TemporaryDirectory() as directory:
            root=self.make_root(directory,'DJANGO_SECRET_KEY=short\n')
            before=(root/'.env').read_bytes()
            result=self.run_setup(root)
            self.assertNotEqual(result.returncode,0)
            self.assertEqual((root/'.env').read_bytes(),before)

    def test_missing_certificate_fails_before_creating_key(self):
        with tempfile.TemporaryDirectory() as directory:
            root=self.make_root(directory)
            (root/'supabase-ca.crt').unlink()
            before=(root/'.env').read_bytes()
            self.assertNotEqual(self.run_setup(root).returncode,0)
            self.assertEqual((root/'.env').read_bytes(),before)
