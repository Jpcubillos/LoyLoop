"""Fixed-issuer asymmetric JWT verification; headers never select a network URL."""
import json
import threading
import time
from urllib.request import Request,build_opener,HTTPRedirectHandler
from uuid import UUID
import jwt
from rest_framework.exceptions import AuthenticationFailed,APIException

class SigningKeysUnavailable(APIException):
    status_code=503
    default_detail='No pudimos verificar la sesion. Intentalo mas tarde.'

class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

_cache={}
_lock=threading.Lock()
TTL=60

def signing_keys(issuer):
    # Bounded per-worker cache. No stale-on-error and no per-kid forced fetch:
    # arbitrary kid values cannot trigger an unbounded refresh storm.
    with _lock:
        cached=_cache.get(issuer)
        if cached and time.monotonic()<cached[0]:
            if cached[1] is None:raise SigningKeysUnavailable()
            return cached[1]
        try:
            request=Request(issuer+'/.well-known/jwks.json',headers={'Accept':'application/json'})
            with build_opener(NoRedirects()).open(request,timeout=5) as response:
                raw=response.read(131073)
                if response.status!=200 or len(raw)>131072:raise ValueError()
                data=json.loads(raw)
                if not isinstance(data,dict) or not isinstance(data.get('keys'),list) or len(data['keys'])>32:raise ValueError()
        except (OSError,ValueError,TypeError):
            _cache.clear();_cache[issuer]=(time.monotonic()+5,None)
            raise SigningKeysUnavailable() from None
        _cache.clear();_cache[issuer]=(time.monotonic()+TTL,data)
        return data

def verify_claims(token,issuer):
    try:
        if not isinstance(token,str) or len(token)>8192:raise ValueError()
        header=jwt.get_unverified_header(token)
        algorithm=header.get('alg')
        kid=header.get('kid')
        if algorithm not in ('ES256','RS256') or not isinstance(kid,str) or not 1<=len(kid)<=128:raise ValueError()
        if any(key in header for key in ['jku','jwk','x5u','crit']):raise ValueError()
        keys=signing_keys(issuer)['keys']
        matching=[key for key in keys if isinstance(key,dict) and key.get('kid')==kid]
        if len(matching)!=1:raise ValueError()
        key=matching[0]
        if (key.get('alg')!=algorithm or key.get('use','sig')!='sig' or 'd' in key
                or key.get('kty')!=('EC' if algorithm=='ES256' else 'RSA')
                or ('key_ops' in key and 'verify' not in key['key_ops'])):raise ValueError()
        claims=jwt.decode(token,jwt.PyJWK.from_dict(key,algorithm=algorithm).key,
            algorithms=[algorithm],issuer=issuer,audience='authenticated',leeway=0,
            options={'require':['iss','aud','exp','iat','sub','session_id','role']})
        if claims['role']!='authenticated' or claims.get('is_anonymous',False):raise ValueError()
        if any(type(claims[field]) is not int for field in ['iat','exp']):raise ValueError()
        UUID(claims['sub']);UUID(claims['session_id'])
        return claims
    except (jwt.PyJWTError,ValueError,TypeError,KeyError,AttributeError):
        raise AuthenticationFailed('La sesion no es valida o ha vencido.') from None
