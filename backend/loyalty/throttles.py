"""DRF throttles compatible with verified Supabase Principal (UUID, not Django pk).

Distributed deployment must configure a shared Django cache backend so rate
limits are consistent across workers; default LocMemCache is per-process.
"""
from rest_framework.throttling import ScopedRateThrottle


class PrincipalScopedThrottle(ScopedRateThrottle):
    def get_cache_key(self, request, view):
        principal = getattr(request, 'user', None)
        if principal is not None and getattr(principal, 'is_authenticated', False):
            identifier = str(principal.id)
        else:
            identifier = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': identifier}
