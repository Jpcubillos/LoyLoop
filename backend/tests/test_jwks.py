import json,time,unittest
from unittest.mock import patch
from uuid import uuid4
import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from rest_framework.exceptions import AuthenticationFailed

class JWKSVerificationTests(unittest.TestCase):
    def setUp(self):
        self.private=ec.generate_private_key(ec.SECP256R1())
        self.jwk=json.loads(jwt.algorithms.ECAlgorithm.to_jwk(self.private.public_key()))
        self.jwk.update(kid='fixture',alg='ES256',use='sig')
        self.issuer='https://test.supabase.co/auth/v1'
        self.claims={'iss':self.issuer,'aud':'authenticated','sub':str(uuid4()),'session_id':str(uuid4()),'role':'authenticated','iat':int(time.time()),'exp':int(time.time())+300}
    def token(self,**changes):
        return jwt.encode({**self.claims,**changes},self.private,algorithm='ES256',headers={'kid':'fixture'})
    def verify(self,token):
        from config.jwt_verification import verify_claims
        with patch('config.jwt_verification.signing_keys',return_value={'keys':[self.jwk]}):
            return verify_claims(token,self.issuer)
    def test_valid_signature_and_all_claims(self):
        self.assertEqual(self.verify(self.token())['sub'],self.claims['sub'])
    def test_negative_claims(self):
        for changes in [{'iss':'https://other.invalid/auth/v1'},{'aud':'anon'},{'exp':int(time.time())-60},{'iat':int(time.time())+100},{'role':'service_role'},{'sub':'bad'},{'session_id':'bad'},{'exp':None}]:
            with self.subTest(changes=changes),self.assertRaises(AuthenticationFailed):self.verify(self.token(**changes))
    def test_wrong_key_missing_claim_and_none_algorithm(self):
        other=ec.generate_private_key(ec.SECP256R1())
        bad=jwt.encode(self.claims,other,algorithm='ES256',headers={'kid':'fixture'})
        missing=dict(self.claims);missing.pop('exp')
        for token in [bad,jwt.encode(missing,self.private,algorithm='ES256',headers={'kid':'fixture'}),jwt.encode(self.claims,key='',algorithm='none'),jwt.encode(self.claims,'isolated-test-secret-32-characters',algorithm='HS256')]:
            with self.assertRaises(AuthenticationFailed):self.verify(token)
    def test_unknown_kid_and_duplicate_keys_rejected(self):
        from config.jwt_verification import verify_claims
        for keys in [[],[{**self.jwk,'kid':'other'}],[self.jwk,self.jwk]]:
            with patch('config.jwt_verification.signing_keys',return_value={'keys':keys}),self.assertRaises(AuthenticationFailed):verify_claims(self.token(),self.issuer)

    def test_key_cache_rotation_outage_and_no_redirects(self):
        from config import jwt_verification as module
        from unittest.mock import MagicMock
        module._cache.clear()
        response=MagicMock();response.status=200;response.read.return_value=json.dumps({'keys':[self.jwk]}).encode()
        with patch.object(module,'build_opener') as opener,patch.object(module.time,'monotonic',return_value=10):
            opener.return_value.open.return_value.__enter__.return_value=response
            self.assertEqual(module.signing_keys(self.issuer)['keys'][0]['kid'],'fixture')
            module.signing_keys(self.issuer)
            self.assertEqual(opener.return_value.open.call_count,1)
            req=opener.return_value.open.call_args.args[0]
            self.assertEqual(req.full_url,self.issuer+'/.well-known/jwks.json')
            self.assertIsNone(req.get_header('Authorization'))
        with patch.object(module.time,'monotonic',return_value=71),patch.object(module,'build_opener') as opener:
            response.read.return_value=json.dumps({'keys':[{**self.jwk,'kid':'rotated'}]}).encode()
            opener.return_value.open.return_value.__enter__.return_value=response
            self.assertEqual(module.signing_keys(self.issuer)['keys'][0]['kid'],'rotated')
        with patch.object(module.time,'monotonic',return_value=132),patch.object(module,'build_opener') as opener:
            opener.return_value.open.side_effect=OSError('private diagnostic')
            for _ in range(2):
                with self.assertRaises(module.SigningKeysUnavailable):module.signing_keys(self.issuer)
            self.assertEqual(opener.return_value.open.call_count,1)
        self.assertIsNone(module.NoRedirects().redirect_request(None,None,302,None,None,'https://evil.invalid'))
        module._cache.clear()

    def test_header_cannot_override_trust_source(self):
        from config.jwt_verification import verify_claims
        for header in [{'jku':'https://evil.invalid'},{'jwk':self.jwk},{'x5u':'https://evil.invalid'},{'crit':['anything']}]:
            token=jwt.encode(self.claims,self.private,algorithm='ES256',headers={'kid':'fixture',**header})
            with patch('config.jwt_verification.signing_keys') as fetch,self.assertRaises(AuthenticationFailed):verify_claims(token,self.issuer)
            fetch.assert_not_called()

    def test_rs256_is_verified_without_algorithm_confusion(self):
        from cryptography.hazmat.primitives.asymmetric import rsa
        from config.jwt_verification import verify_claims
        private=rsa.generate_private_key(public_exponent=65537,key_size=2048)
        key=json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private.public_key()));key.update(kid='rsa-fixture',alg='RS256',use='sig')
        token=jwt.encode(self.claims,private,algorithm='RS256',headers={'kid':'rsa-fixture'})
        with patch('config.jwt_verification.signing_keys',return_value={'keys':[key]}):
            self.assertEqual(verify_claims(token,self.issuer)['sub'],self.claims['sub'])
        key['alg']='ES256'
        with patch('config.jwt_verification.signing_keys',return_value={'keys':[key]}),self.assertRaises(AuthenticationFailed):verify_claims(token,self.issuer)
