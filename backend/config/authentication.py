"""Verify bearer sessions with the configured Supabase Auth server over HTTPS.

No JWT payload or editable metadata is used to authorize business actions.
Remote validation also supports the project's legacy symmetric signing keys.
"""
from dataclasses import dataclass
import json
import os
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError
from uuid import UUID

from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed, APIException


class AuthUnavailable(APIException):
    status_code = 503
    default_detail = 'No pudimos verificar la sesion. Intentalo mas tarde.'
    default_code = 'authentication_unavailable'


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


@dataclass(frozen=True)
class Principal:
    id: UUID
    email: str
    full_name: str
    is_authenticated: bool = True
    is_anonymous: bool = False


def verified_user(token):
    base = os.environ.get('SUPABASE_AUTH_URL', '').rstrip('/')
    key = os.environ.get('SUPABASE_PUBLISHABLE_KEY', '')
    try:
        url = urlsplit(base)
        port = url.port
    except ValueError:
        raise AuthUnavailable() from None
    if (url.scheme != 'https' or not url.hostname or url.username or url.password
            or url.query or url.fragment or url.path != '/auth/v1' or port not in (None, 443) or not key):
        raise AuthUnavailable()
    request = Request(base+'/user', headers={'Authorization':'Bearer '+token, 'apikey':key})
    try:
        with build_opener(NoRedirects()).open(request, timeout=5) as response:
            data = response.read(131073)
            if response.status != 200 or len(data)>131072:
                raise AuthUnavailable()
            user = json.loads(data)
    except HTTPError as exc:
        exc.close()
        if exc.code in (401, 403):
            raise AuthenticationFailed('La sesion no es valida o ha vencido.') from None
        raise AuthUnavailable() from None
    except (URLError, TimeoutError, OSError, ValueError):
        raise AuthUnavailable() from None
    try:
        identifier = UUID(user['id'])
        email = user['email'].strip().lower()
        if not email or not user.get('email_confirmed_at') or user.get('is_anonymous'):
            raise ValueError()
    except (KeyError, TypeError, ValueError, AttributeError):
        raise AuthenticationFailed('Verifica tu cuenta antes de continuar.') from None
    metadata = user.get('user_metadata') or {}
    name = metadata.get('full_name') if isinstance(metadata,dict) else None
    name = name.strip()[:150] if isinstance(name,str) and name.strip() else 'Cliente LoyLoop'
    return Principal(identifier, email, name)


class SupabaseAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header = get_authorization_header(request).split()
        if not header:
            return None
        if len(header)!=2 or header[0].lower()!=b'bearer' or len(header[1])>8192:
            raise AuthenticationFailed('Credenciales de sesion no validas.')
        try:
            token = header[1].decode('ascii')
        except UnicodeError:
            raise AuthenticationFailed('Credenciales de sesion no validas.') from None
        return verified_user(token), None

    def authenticate_header(self, request):
        return 'Bearer'
