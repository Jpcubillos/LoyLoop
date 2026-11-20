"""Tenant/role authorization from server-owned records, never from request data."""
from django.db.models.functions import Lower, Trim
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from .models import AppUser, Business
from config.telemetry import tenant


def account_for(principal):
    bound = AppUser.objects.filter(auth_user_id=principal.id).first()
    if bound:
        if not bound.active:
            raise PermissionDenied('Tu cuenta no tiene acceso activo.')
        return bound
    rows = list(AppUser.objects.annotate(normalized_email=Lower(Trim('email'))).filter(normalized_email=principal.email)[:2])
    if len(rows)>1:
        raise PermissionDenied('Tu cuenta requiere revision de acceso.')
    if rows and not rows[0].active:
        raise PermissionDenied('Tu cuenta no tiene acceso activo.')
    if rows and rows[0].auth_user_id not in (None, principal.id):
        raise PermissionDenied('Tu cuenta requiere revision de acceso.')
    return rows[0] if rows else None


def business_for(principal, business_id, roles):
    business = get_object_or_404(Business, pk=business_id)
    account = account_for(principal)
    role = None
    if business.owner_user_id == principal.id:
        role = 'owner'
    elif account and account.auth_user_id==principal.id and account.account_type=='business' and account.business_id==business.id:
        role = account.business_role
    if role not in roles:
        raise PermissionDenied('No tienes permiso para esta accion en el comercio.')
    tenant.set(business.id)
    return business
