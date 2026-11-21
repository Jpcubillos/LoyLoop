"""Existing public HTTP contracts delegated to central transactional services.

Legacy URLs and response shapes are retained while /api/v1/ clients migrate.
"""
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from .throttles import PrincipalScopedThrottle

from .access import business_for
from .api import AuthenticatedView, ensure_customer
from .domain_services import (invalid, strict, segment, eligible_campaign,
    eligible_reward, stamp_card, audit_success, issue_claim, claim_result, confirm_claim,
    preview_claim)
from .models import Business, BusinessMembership, LoyaltyEvent, ClaimRequest
from .cutover import require_domain


def audited(principal, business):
    audit_success(principal.id, business.id)


class MembershipView(AuthenticatedView):
    def post(self, request, business_id):
        strict(request.data, [])
        business = get_object_or_404(Business, pk=business_id)
        with transaction.atomic():
            customer = ensure_customer(request.user)
            membership, created = BusinessMembership.objects.get_or_create(
                customer=customer, business=business, defaults={'tier': 'Miembro'})
            if created:
                LoyaltyEvent.objects.create(business=business, customer=customer,
                    event_type='join', metadata={'label': 'Inscripcion al comercio'})
                audited(request.user, business)
        return Response({'id': str(membership.id)}, status=201 if created else 200)


class ClaimsView(AuthenticatedView):
    def post(self, request):
        require_domain()
        strict(request.data, ['actionType', 'businessSlug', 'payload'])
        business = get_object_or_404(Business, slug=request.data.get('businessSlug'))
        with transaction.atomic():
            customer = ensure_customer(request.user)
            if not BusinessMembership.objects.filter(business=business, customer=customer).exists():
                raise PermissionDenied('Unete al comercio antes de reclamar.')
            claim, created, manual_code = issue_claim(business=business, customer=customer,
                action=request.data.get('actionType'), payload=request.data.get('payload', {}),
                actor_id=request.user.id, idempotency_key=request.headers.get('Idempotency-Key'))
        return Response(claim_result(claim, manual_code), status=201 if created else 200)

    def get(self, request, code):
        customer = ensure_customer(request.user)
        claim = get_object_or_404(ClaimRequest, code=code, customer=customer)
        from django.utils import timezone
        status = 'expired' if claim.status == 'pending' and claim.expires_at <= timezone.now() else claim.status
        return Response({'status': status, 'expiresAt': claim.expires_at.isoformat()})


class ValidateClaimView(AuthenticatedView):
    throttle_classes = [PrincipalScopedThrottle]
    throttle_scope = 'loyloop_validation'

    def post(self, request, business_id):
        require_domain()
        business = business_for(request.user, business_id, {'owner','manager','cashier'})
        strict(request.data, ['code'])
        result = confirm_claim(business=business, code=request.data.get('code'), actor_id=request.user.id)
        return Response({'ok':result['ok'], 'message':result['message']}, status=result['httpStatus'])


class PreviewClaimView(AuthenticatedView):
    throttle_classes = [PrincipalScopedThrottle]
    throttle_scope = 'loyloop_validation'

    def post(self, request, business_id):
        require_domain()
        business = business_for(request.user, business_id, {'owner','manager','cashier'})
        strict(request.data, ['code'])
        result = preview_claim(business=business, code=request.data.get('code'))
        return Response(result, status=200)


class V1ClaimsView(ClaimsView):
    """New clients must supply a stable idempotency key; legacy stays compatible."""
    def post(self, request):
        if not request.headers.get('Idempotency-Key'):
            invalid('Se requiere Idempotency-Key para emitir un canje.')
        return super().post(request)
