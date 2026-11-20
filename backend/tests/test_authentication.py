import unittest
from test_bootstrap import KEY, run_python


class BearerAuthenticationTests(unittest.TestCase):
    def check(self, script):
        result=run_python(['-c',script],variables={'DJANGO_SECRET_KEY':KEY,
            'SUPABASE_AUTH_URL':'https://test.supabase.co/auth/v1','SUPABASE_PUBLISHABLE_KEY':'test-public-key'})
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertNotIn('private-token-marker',result.stdout+result.stderr)

    def test_missing_or_malformed_bearer_never_calls_provider(self):
        self.check('''
import django; django.setup()
from unittest.mock import patch
from rest_framework.test import APIRequestFactory
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from config.authentication import SupabaseAuthentication
class View(APIView):
 authentication_classes=[SupabaseAuthentication]
 permission_classes=[IsAuthenticated]
 def get(self,request): return Response({'ok':True})
with patch('config.authentication.verified_user') as provider:
 for header in ['', 'Basic private-token-marker', 'Bearer a b', 'Bearer '+('a'*8193)]:
  response=View.as_view()(APIRequestFactory().get('/',HTTP_AUTHORIZATION=header))
  assert response.status_code==401, response.status_code
 provider.assert_not_called()
''')

    def test_provider_identity_is_verified_and_metadata_cannot_grant_roles(self):
        self.check('''
import django; django.setup()
import json
from uuid import uuid4
from unittest.mock import patch, MagicMock
from config.authentication import verified_user
uid=str(uuid4())
response=MagicMock(); response.status=200
response.read.return_value=json.dumps({'id':uid,'email':' Verified@Example.invalid ','email_confirmed_at':'2026-01-01T00:00:00Z','user_metadata':{'role':'owner','full_name':'Fixture'}}).encode()
with patch('config.authentication.verify_claims',return_value={'sub':uid}),patch('config.authentication.build_opener') as opener:
 opener.return_value.open.return_value.__enter__.return_value=response
 user=verified_user('private-token-marker')
 assert str(user.id)==uid and user.email=='verified@example.invalid'
 assert not hasattr(user,'role') and not hasattr(user,'business_role')
 request=opener.return_value.open.call_args.args[0]
 assert request.full_url=='https://test.supabase.co/auth/v1/user'
 assert request.get_header('Authorization')=='Bearer private-token-marker'
''')

    def test_unverified_accounts_and_provider_failure_fail_closed(self):
        self.check('''
import django; django.setup()
import json
from uuid import uuid4
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError
from config.authentication import verified_user,AuthUnavailable
from rest_framework.exceptions import AuthenticationFailed
base={'id':str(uuid4()),'email':'fixture@example.invalid','email_confirmed_at':'2026-01-01','is_anonymous':False}
with patch('config.authentication.verify_claims',return_value={'sub':base['id']}),patch('config.authentication.build_opener') as opener:
 response=MagicMock();response.status=200
 opener.return_value.open.return_value.__enter__.return_value=response
 for changed in [{'email_confirmed_at':None},{'is_anonymous':True},{'id':'invalid'}]:
  response.read.return_value=json.dumps({**base,**changed}).encode()
  try: verified_user('private-token-marker')
  except AuthenticationFailed: pass
  else: raise AssertionError('Unverified identity accepted')
 for status,expected in [(401,AuthenticationFailed),(403,AuthenticationFailed),(429,AuthUnavailable),(500,AuthUnavailable),(302,AuthUnavailable)]:
  opener.return_value.open.side_effect=HTTPError('https://test.supabase.co/auth/v1/user',status,'private-token-marker',{},None)
  try: verified_user('private-token-marker')
  except expected as exc: assert 'private-token-marker' not in str(exc)
  else: raise AssertionError('Provider failure accepted')
''')

    def test_only_configured_https_endpoint_and_no_redirects(self):
        self.check('''
import django; django.setup()
import os
from unittest.mock import patch
from config.authentication import verified_user,AuthUnavailable,NoRedirects
assert NoRedirects().redirect_request(None,None,302,None,None,'https://other.invalid') is None
for url in ['http://test.supabase.co/auth/v1','https://user:password@test.supabase.co/auth/v1','https://test.supabase.co/auth/v1?secret=1','https://test.supabase.co:bad/auth/v1']:
 with patch.dict(os.environ,{'SUPABASE_AUTH_URL':url}),patch('config.authentication.build_opener') as opener:
  try:verified_user('private-token-marker')
  except AuthUnavailable:pass
  else:raise AssertionError('Unsafe Auth endpoint accepted')
  opener.assert_not_called()
''')

    def test_invalid_signature_never_reaches_user_endpoint(self):
        self.check("""
import django;django.setup()
from unittest.mock import patch
from config.authentication import verified_user
from rest_framework.exceptions import AuthenticationFailed
with patch('config.authentication.build_opener') as provider:
 try:verified_user('private-token-marker')
 except AuthenticationFailed:pass
 else:raise AssertionError('Malformed token accepted')
 provider.assert_not_called()
""")

    def test_user_endpoint_must_match_signed_subject_and_is_checked_every_request(self):
        self.check("""
import django;django.setup()
import json
from uuid import uuid4
from unittest.mock import patch,MagicMock
from config.authentication import verified_user
from rest_framework.exceptions import AuthenticationFailed
uid=str(uuid4());other=str(uuid4())
r=MagicMock();r.status=200
with patch('config.authentication.verify_claims',return_value={'sub':uid}),patch('config.authentication.build_opener') as opener:
 opener.return_value.open.return_value.__enter__.return_value=r
 r.read.return_value=json.dumps({'id':other,'email':'test@example.invalid','email_confirmed_at':'2026-01-01'}).encode()
 try:verified_user('private-token-marker')
 except AuthenticationFailed:pass
 else:raise AssertionError('Subject mismatch accepted')
 r.read.return_value=json.dumps({'id':uid,'email':'test@example.invalid','email_confirmed_at':'2026-01-01'}).encode()
 verified_user('private-token-marker');verified_user('private-token-marker')
 assert opener.return_value.open.call_count==3
""")
