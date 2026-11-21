"""LL domain operations. Server-authorized callers only; all writes are transactional.

Neither local loyalty points nor global XP are currencies. This module never
subtracts loyalty points in a redemption. Older endpoints delegate here too.
"""
import hashlib
import json
import re
import secrets
from datetime import timedelta
from uuid import UUID

from django.db import connection, transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException, PermissionDenied

from config.audit import record_event
from config.telemetry import tenant
from .models import (ActivityReceipt, Business, BusinessMembership, Campaign,
                     CampaignRedemption, ClaimRequest, CustomerProfile,
                     IdentityChallenge, LoyaltyEvent, Reward, StampCard,
                     StampCompletion, RewardRedemption)


class Conflict(APIException):
    status_code = 409
    default_detail = 'La operacion ya existe con datos distintos o no puede repetirse.'
    default_code = 'conflict'


def invalid(message):
    raise serializers.ValidationError({'detail': message})


def strict(data, allowed):
    if not isinstance(data, dict) or set(data) - set(allowed):
        invalid('La solicitud contiene campos no admitidos.')


def audit_success(actor_id, business_id):
    tenant.set(business_id)
    transaction.on_commit(lambda: record_event(event='business_action', outcome='success',
        actor_id=actor_id, tenant_id=business_id))


def segment(business, customer):
    visits = LoyaltyEvent.objects.filter(business=business, customer=customer,
        event_type__in=['purchase','stamp','minipay_payment'])
    last = visits.order_by('-created_at').first()
    days = (timezone.now()-last.created_at).days if last else float('inf')
    if days >= business.inactive_days:
        return 'inactive'
    if days >= business.at_risk_days:
        return 'at_risk'
    return 'vip' if visits.count() >= business.vip_purchase_threshold else 'active'


def eligible_campaign(business, customer, action, campaign_id):
    try:
        campaign_id = UUID(str(campaign_id))
    except (ValueError, TypeError):
        invalid('Selecciona una promocion valida.')
    campaign = get_object_or_404(Campaign.objects.select_for_update(),
        pk=campaign_id, business=business)
    now = timezone.now()
    if (not campaign.active or campaign.status not in {'active','scheduled'}
            or campaign.type != action
            or campaign.status == 'scheduled' and campaign.starts_at is None
            or campaign.starts_at and campaign.starts_at > now
            or campaign.ends_at and campaign.ends_at <= now
            or campaign.audience_segment != segment(business, customer)
            or CampaignRedemption.objects.filter(campaign=campaign, customer=customer).exists()
            or campaign.redemption_limit is not None and
                CampaignRedemption.objects.filter(campaign=campaign).count() >= campaign.redemption_limit):
        invalid('Esta promocion no esta disponible para tu cuenta.')
    return campaign


def eligible_reward(business, customer, reward_id, points):
    try:
        reward_id = UUID(str(reward_id))
    except (ValueError, TypeError):
        invalid('Selecciona un beneficio valido.')
    reward = get_object_or_404(Reward.objects.select_for_update(),
        pk=reward_id, business=business)
    # points_required is only a minimum eligibility threshold, NOT a price.
    if (not reward.active or reward.audience_segment != segment(business, customer)
            or points < (reward.points_required or 0)
            or reward.redemption_limit is not None and
                RewardRedemption.objects.filter(reward=reward).count() >= reward.redemption_limit):
        invalid('Este beneficio no esta disponible para tu cuenta.')
    return reward


def stamp_card(business, customer, create=False):
    # Legacy card naming/shape preserved until the dedicated stamp-program HU.
    fields = dict(business=business, customer=customer, reward_name='Cafe gratis con 10 sellos')
    card = StampCard.objects.select_for_update().filter(**fields).first()
    if card is None and create:
        card = StampCard.objects.create(**fields)
    if not card or not card.active:
        invalid('No tienes una tarjeta de sellos activa.')
    return card


def _digest(value):
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def _fingerprint(value):
    return _digest(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True))


def _reference(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:-]{7,119}', value):
        invalid('Se requiere una referencia unica de 8 a 120 caracteres sin datos personales.')
    return value


@transaction.atomic
def record_confirmed_activity(*, business, membership_id, actor_id, reference,
                              points, stamps=0, card_id=None, reason=''):
    """A verified merchant records ONE externally confirmed activity.

    The business+reference constraint and advisory key lock serialize duplicate
    submits, even if they target different memberships or arrive on workers.
    Membership row lock protects counters from concurrent claims.
    """
    reference = _reference(reference)
    if not isinstance(points, int) or isinstance(points, bool) or not 0 <= points <= 100000:
        invalid('Puntos fuera de rango.')
    if not isinstance(stamps, int) or isinstance(stamps, bool) or not 0 <= stamps <= 20:
        invalid('Sellos fuera de rango.')
    if not (points or stamps):
        invalid('La actividad debe acreditar puntos o sellos.')
    if not isinstance(reason, str) or not 5 <= len(reason.strip()) <= 200:
        invalid('Indica el motivo de la actividad confirmada (5-200 caracteres).')
    if stamps and card_id is None or not stamps and card_id is not None:
        invalid('La tarjeta debe indicarse solamente cuando se acrediten sellos.')
    try:
        member_id = UUID(str(membership_id))
        card_uuid = UUID(str(card_id)) if card_id is not None else None
    except (ValueError, TypeError):
        invalid('Identificador no valido.')
    payload = {'membership_id': str(member_id), 'points': points, 'stamps': stamps,
               'card_id': str(card_uuid) if card_uuid else None, 'reason': reason.strip()}
    fingerprint = _fingerprint(payload)
    # Tenant-qualified hash; unique DB constraint is final enforcement layer.
    with connection.cursor() as cursor:
        cursor.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s, 73))',
                       [str(business.pk) + ':' + reference])
    existing = ActivityReceipt.objects.filter(business=business, reference=reference).first()
    if existing:
        if existing.fingerprint != fingerprint:
            raise Conflict('La referencia pertenece a una actividad diferente.')
        return existing, False
    member = get_object_or_404(BusinessMembership.objects.select_for_update(),
                               pk=member_id, business=business)
    card = None
    if stamps:
        card = get_object_or_404(StampCard.objects.select_for_update(), pk=card_uuid,
                                 business=business, customer_id=member.customer_id, active=True)
        if card.current_stamps + stamps > card.required_stamps:
            invalid('Los sellos exceden el limite de la tarjeta; confirma primero el canje.')
    if points:
        # Never subtract points: these are historical, permanent per business.
        member.points_balance = F('points_balance') + points
        member.save(update_fields=['points_balance'])
    if card:
        card.current_stamps = F('current_stamps') + stamps
        card.updated_at = timezone.now()
        card.save(update_fields=['current_stamps', 'updated_at'])
    event = LoyaltyEvent.objects.create(business=business, customer_id=member.customer_id,
        event_type='purchase', points_delta=points,
        metadata={'reference': reference, 'stamps_awarded': stamps,
                  'stamp_card_id': str(card_uuid) if card_uuid else None, 'reason': reason.strip()})
    receipt = ActivityReceipt.objects.create(business=business, customer_id=member.customer_id,
        event=event, reference=reference, fingerprint=fingerprint, actor_id=actor_id,
        points_awarded=points, stamps_awarded=stamps, card=card)
    audit_success(actor_id, business.id)
    return receipt, True


def activity_result(receipt):
    return {'id': str(receipt.id), 'eventId': str(receipt.event_id),
            'pointsAwarded': receipt.points_awarded, 'stampsAwarded': receipt.stamps_awarded,
            'appliedAt': receipt.created_at.isoformat()}


@transaction.atomic
def issue_identification(*, business, customer):
    membership = get_object_or_404(BusinessMembership, business=business, customer=customer)
    token = secrets.token_urlsafe(32)
    manual = ''.join(str(secrets.randbelow(10)) for _ in range(16))
    # Only high-entropy digests are kept in PostgreSQL. Each may be used once.
    IdentityChallenge.objects.create(business=business, customer=customer,
        token_hash=_digest(token), manual_hash=_digest(manual),
        expires_at=timezone.now() + timedelta(seconds=90))
    return {'token': token, 'manualCode': manual,
            'businessId': str(business.id), 'membershipId': str(membership.id),
            'expiresInSeconds': 90}


@transaction.atomic
def consume_identification(*, business, operator_id, submitted_code):
    if not isinstance(submitted_code, str) or not 10 <= len(submitted_code) <= 128:
        invalid('Codigo de identificacion no valido.')
    digest = _digest(submitted_code.strip())
    challenge = IdentityChallenge.objects.select_for_update().filter(
        business=business, token_hash=digest).first()
    if challenge is None:
        challenge = get_object_or_404(IdentityChallenge.objects.select_for_update(),
                                      business=business, manual_hash=digest)
    if challenge.consumed_at or challenge.expires_at <= timezone.now():
        raise Conflict('El codigo ya fue usado o ha expirado.')
    member = get_object_or_404(BusinessMembership, business=business,
                               customer_id=challenge.customer_id)
    challenge.consumed_at = timezone.now()
    challenge.consumed_by = operator_id
    challenge.save(update_fields=['consumed_at','consumed_by'])
    audit_success(operator_id, business.id)
    customer = member.customer
    return {'membershipId': str(member.id), 'customerName': customer.full_name,
            'tier': member.tier, 'pointsAccumulated': member.points_balance}


def _claim_payload(action, payload, business, customer, membership):
    if not isinstance(payload, dict):
        invalid('La solicitud no es valida.')
    if action == 'discount_redeem' and payload.get('rewardId'):
        if payload.get('campaignId'):
            invalid('Selecciona un unico beneficio.')
        reward = eligible_reward(business, customer, payload['rewardId'], membership.points_balance)
        if reward.type not in {'discount', 'product'}:
            invalid('Este beneficio requiere otro tipo de validacion.')
        return {'rewardId': str(reward.id)}
    if action in {'discount_redeem','points_boost'}:
        campaign = eligible_campaign(business, customer, action, payload.get('campaignId'))
        return {'campaignId': str(campaign.id)}
    if action == 'stamp_redeem':
        card = stamp_card(business, customer)
        if card.current_stamps < card.required_stamps:
            invalid('Completa los sellos antes de reclamar.')
    return {}


@transaction.atomic
def issue_claim(*, business, customer, action, payload, actor_id, idempotency_key=None):
    if action not in {'stamp_add','stamp_redeem','discount_redeem','points_boost'}:
        invalid('Accion no admitida.')
    if idempotency_key is not None:
        idempotency_key = _reference(idempotency_key)
    membership = get_object_or_404(BusinessMembership.objects.select_for_update(),
                                   business=business, customer=customer)
    # A retry must remain safe even AFTER the first claim has been redeemed.
    # Never rerun eligibility rules against a previously accepted request.
    if idempotency_key:
        existing = ClaimRequest.objects.filter(business=business, customer=customer,
                                                idempotency_key=idempotency_key).first()
        if existing:
            if not isinstance(payload, dict):
                invalid('La solicitud no es valida.')
            raw_id = payload.get('rewardId') if action == 'discount_redeem' and payload.get('rewardId') else payload.get('campaignId')
            same_payload = {} if action in {'stamp_add','stamp_redeem'} else (
                {'rewardId': str(raw_id)} if action == 'discount_redeem' and payload.get('rewardId') else
                {'campaignId': str(raw_id)})
            if existing.request_fingerprint != _fingerprint({'action':action,'payload':same_payload}):
                raise Conflict('La referencia de canje ya se utilizo para otra solicitud.')
            return existing, False, None
    safe_payload = _claim_payload(action, payload, business, customer, membership)
    fingerprint = _fingerprint({'action': action, 'payload': safe_payload})
    raw_manual = ''.join(str(secrets.randbelow(10)) for _ in range(16))
    claim = ClaimRequest.objects.create(business=business, customer=customer,
        action_type=action, payload=safe_payload,
        code=secrets.token_hex(12).upper(), manual_code_hash=_digest(raw_manual),
        idempotency_key=idempotency_key, request_fingerprint=fingerprint,
        expires_at=timezone.now()+timedelta(minutes=5))
    audit_success(actor_id, business.id)
    return claim, True, raw_manual


def claim_result(claim, manual_code=None):
    result = {'ok': True, 'code': claim.code, 'expiresAt': claim.expires_at.isoformat(),
              'status': claim.status}
    # Manual code cannot be recovered from a one-way hash on retries.
    # The stable QR code is always returned and is also accepted for manual entry.
    if manual_code:
        result['manualCode'] = manual_code
    return result


@transaction.atomic
def confirm_claim(*, business, code, actor_id):
    if not isinstance(code,str) or not 1 <= len(code.strip()) <= 128:
        invalid('Ingresa un codigo valido.')
    normalized = code.strip().upper()
    # QR code is the legacy stable code; numeric entry uses a hash.
    claim = ClaimRequest.objects.select_for_update().filter(
        code=normalized,business=business).first()
    if claim is None and normalized.isdigit() and len(normalized) == 16:
        claim = ClaimRequest.objects.select_for_update().filter(
            manual_code_hash=_digest(normalized), business=business).first()
    if claim is None:
        from django.http import Http404
        raise Http404()
    if claim.status != 'pending':
        raise Conflict('Este QR ya fue procesado.')
    if claim.expires_at <= timezone.now():
        claim.status = 'expired'
        claim.save(update_fields=['status'])
        # The HTTP response must be issued without rolling back this transition.
        return {'ok': False, 'message': 'El QR ha expirado.', 'httpStatus': 409}
    membership = get_object_or_404(BusinessMembership.objects.select_for_update(),
                                   business=business, customer_id=claim.customer_id)
    points = 0
    metadata = {}
    if claim.action_type in {'stamp_add','stamp_redeem'}:
        card = stamp_card(business, claim.customer, create=claim.action_type == 'stamp_add')
        if claim.action_type == 'stamp_add':
            if card.current_stamps >= card.required_stamps:
                invalid('La tarjeta ya esta completa.')
            card.current_stamps = F('current_stamps') + 1
            points = 10  # Legacy program rule; preserve until configurable.
            event = 'stamp'
        else:
            if card.current_stamps < card.required_stamps:
                invalid('La tarjeta aun no esta completa.')
            card.current_stamps = 0
            event = 'reward_redeem'
            cycle = StampCompletion.objects.filter(card=card).count() + 1
            StampCompletion.objects.create(card=card, claim=claim, cycle_number=cycle,
                                           confirmed_by=actor_id)
        card.updated_at = timezone.now()
        card.save(update_fields=['current_stamps','updated_at'])
    elif claim.action_type == 'discount_redeem' and claim.payload.get('rewardId'):
        reward = eligible_reward(business, claim.customer, claim.payload['rewardId'],
                                 membership.points_balance)
        if reward.type not in {'discount', 'product'}:
            invalid('Este beneficio requiere otro tipo de validacion.')
        RewardRedemption.objects.create(reward=reward, claim=claim, business=business,
                                        customer=claim.customer, confirmed_by=actor_id)
        event = 'reward_redeem'
        metadata = {'reward_id': str(reward.id), 'label': reward.name}
    else:
        campaign = eligible_campaign(business, claim.customer, claim.action_type,
                                     claim.payload.get('campaignId'))
        CampaignRedemption.objects.create(campaign=campaign, business=business,
                                          customer=claim.customer, claim_request=claim)
        points = campaign.reward_points if claim.action_type == 'points_boost' else 0
        event = 'mission_progress' if claim.action_type == 'points_boost' else 'reward_redeem'
        metadata = {'campaign_id': str(campaign.id)}
        if claim.action_type == 'discount_redeem':
            metadata['discount_percent'] = campaign.discount_percent
    if points:
        membership.points_balance = F('points_balance') + points
        membership.save(update_fields=['points_balance'])
    LoyaltyEvent.objects.create(business=business, customer=claim.customer, event_type=event,
                                points_delta=points, metadata={**metadata, 'claim_id': str(claim.id)})
    claim.status = 'approved'
    claim.approved_at = timezone.now()
    claim.save(update_fields=['status','approved_at'])
    audit_success(actor_id, business.id)
    return {'ok':True,'message':'Validacion aplicada correctamente.','httpStatus':200,
            'customerName': claim.customer.full_name, 'actionType': claim.action_type}


def preview_claim(*, business, code):
    if not isinstance(code, str) or not 1 <= len(code.strip()) <= 128:
        invalid('Ingresa un codigo valido.')
    normalized = code.strip().upper()
    claim = ClaimRequest.objects.filter(code=normalized, business=business).first()
    if claim is None and normalized.isdigit() and len(normalized) == 16:
        claim = ClaimRequest.objects.filter(manual_code_hash=_digest(normalized), business=business).first()
    if claim is None:
        from django.http import Http404
        raise Http404()
    if claim.status != 'pending':
        raise Conflict('Este codigo ya fue procesado.')
    if claim.expires_at <= timezone.now():
        claim.status = 'expired'
        claim.save(update_fields=['status'])
        raise Conflict('El codigo ha expirado.')

    membership = BusinessMembership.objects.filter(business=business, customer_id=claim.customer_id).first()
    if not membership:
        invalid('El cliente no es miembro de este comercio.')

    benefit_title = 'Beneficio'
    detail = ''
    if claim.action_type in {'stamp_add', 'stamp_redeem'}:
        card = stamp_card(business, claim.customer, create=False)
        benefit_title = 'Sumar sello' if claim.action_type == 'stamp_add' else 'Redimir tarjeta'
        detail = f"{card.current_stamps}/{card.required_stamps} sellos ({card.reward_name})"
    elif claim.action_type == 'discount_redeem' and claim.payload.get('rewardId'):
        reward = eligible_reward(business, claim.customer, claim.payload['rewardId'], membership.points_balance)
        benefit_title = reward.name
        detail = reward.description or f"Recompensa ({reward.type})"
    else:
        campaign = eligible_campaign(business, claim.customer, claim.action_type, claim.payload.get('campaignId'))
        benefit_title = campaign.name
        detail = f"{campaign.discount_percent}% de descuento" if campaign.discount_percent else f"+{campaign.reward_points} puntos"

    return {
        'ok': True,
        'claimId': str(claim.id),
        'code': claim.code,
        'customerName': claim.customer.full_name,
        'customerId': str(claim.customer.id),
        'actionType': claim.action_type,
        'benefitTitle': benefit_title,
        'detail': detail,
        'expiresAt': claim.expires_at.isoformat(),
        'status': claim.status,
        'canConfirm': True,
    }

