"""Customer writes and atomic merchant validation, using server-owned values."""
from datetime import timedelta
import secrets
from uuid import UUID

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from config.audit import record_event
from config.telemetry import tenant
from .access import business_for
from .api import AuthenticatedView, ensure_customer
from .models import (Business, BusinessMembership, Campaign, CampaignRedemption,
                     ClaimRequest, LoyaltyEvent, StampCard, Reward)


def invalid(message):
    raise serializers.ValidationError({'detail': message})


def strict(data, allowed):
    if not isinstance(data, dict) or set(data) - set(allowed):
        invalid('La solicitud contiene campos no admitidos.')


def audited(principal, business):
    tenant.set(business.id)
    transaction.on_commit(lambda: record_event(event='business_action', outcome='success',
        actor_id=principal.id, tenant_id=business.id))


class MembershipView(AuthenticatedView):
    def post(self, request, business_id):
        strict(request.data, [])
        business = get_object_or_404(Business, pk=business_id)
        with transaction.atomic():
            customer = ensure_customer(request.user)
            # Identity lock also serializes concurrent joins for the same user.
            membership, created = BusinessMembership.objects.get_or_create(
                customer=customer, business=business, defaults={'tier':'Miembro'})
            if created:
                LoyaltyEvent.objects.create(business=business, customer=customer,
                    event_type='join', metadata={'label':'Inscripcion al comercio'})
                audited(request.user, business)
        return Response({'id':str(membership.id)}, status=201 if created else 200)


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
    if (not campaign.active or campaign.status not in {'active','scheduled'} or campaign.type != action
            or campaign.status=='scheduled' and campaign.starts_at is None
            or campaign.starts_at and campaign.starts_at > now
            or campaign.ends_at and campaign.ends_at <= now
            or campaign.audience_segment != segment(business, customer)
            or CampaignRedemption.objects.filter(campaign=campaign, customer=customer).exists()):
        invalid('Esta promocion no esta disponible para tu cuenta.')
    return campaign


def eligible_reward(business,customer,reward_id,points):
    try:
        reward_id=UUID(str(reward_id))
    except (ValueError,TypeError):
        invalid('Selecciona un beneficio valido.')
    reward=get_object_or_404(Reward.objects.select_for_update(),pk=reward_id,business=business)
    if (not reward.active or reward.audience_segment!=segment(business,customer)
            or points<(reward.points_required or 0)):
        invalid('Este beneficio no esta disponible para tu cuenta.')
    return reward


def stamp_card(business, customer, create=False):
    # Preserve the existing contract; arbitrary reward cards need their own HU.
    query = StampCard.objects.select_for_update()
    fields = dict(business=business, customer=customer, reward_name='Cafe gratis con 10 sellos')
    card = query.filter(**fields).first()
    if card is None and create:
        card = StampCard.objects.create(**fields)
    if not card or not card.active:
        invalid('No tienes una tarjeta de sellos activa.')
    return card


class ClaimsView(AuthenticatedView):
    def post(self, request):
        strict(request.data, ['actionType','businessSlug','payload'])
        action = request.data.get('actionType')
        if action not in {'stamp_add','stamp_redeem','discount_redeem','points_boost'}:
            invalid('Accion no admitida.')
        payload = request.data.get('payload', {})
        if not isinstance(payload, dict):
            invalid('La solicitud no es valida.')
        business = get_object_or_404(Business, slug=request.data.get('businessSlug'))
        with transaction.atomic():
            customer = ensure_customer(request.user)
            membership=BusinessMembership.objects.filter(business=business, customer=customer).first()
            if membership is None:
                raise PermissionDenied('Unete al comercio antes de reclamar.')
            safe_payload = {}
            if action=='discount_redeem' and payload.get('rewardId'):
                if payload.get('campaignId'):
                    invalid('Selecciona un unico beneficio.')
                reward=eligible_reward(business,customer,payload['rewardId'],membership.points_balance)
                if reward.type!='discount':
                    invalid('Este beneficio requiere otro tipo de validacion.')
                safe_payload={'rewardId':str(reward.id)}
            elif action in {'discount_redeem','points_boost'}:
                campaign = eligible_campaign(business,customer,action,payload.get('campaignId'))
                safe_payload = {'campaignId':str(campaign.id)}
            elif action == 'stamp_redeem':
                card = stamp_card(business,customer)
                if card.current_stamps < card.required_stamps:
                    invalid('Completa los sellos antes de reclamar.')
            claim = ClaimRequest.objects.create(business=business, customer=customer,
                action_type=action, payload=safe_payload, code=secrets.token_hex(12).upper(),
                expires_at=timezone.now()+timedelta(minutes=5))
            audited(request.user,business)
        return Response({'ok':True,'code':claim.code,'expiresAt':claim.expires_at.isoformat()},status=201)

    def get(self, request, code):
        customer = ensure_customer(request.user)
        claim = get_object_or_404(ClaimRequest,code=code,customer=customer)
        status = 'expired' if claim.status=='pending' and claim.expires_at<=timezone.now() else claim.status
        return Response({'status':status,'expiresAt':claim.expires_at.isoformat()})


class ValidateClaimView(AuthenticatedView):
    def post(self, request, business_id):
        strict(request.data,['code'])
        code = request.data.get('code')
        if not isinstance(code,str) or not 1<=len(code.strip())<=128:
            invalid('Ingresa un codigo valido.')
        business = business_for(request.user,business_id,{'owner','manager','cashier'})
        with transaction.atomic():
            claim = get_object_or_404(ClaimRequest.objects.select_for_update(),
                code=code.strip().upper(),business=business)
            if claim.status != 'pending':
                return Response({'ok':False,'message':'Este QR ya fue procesado.'},status=409)
            if claim.expires_at <= timezone.now():
                claim.status='expired'; claim.save(update_fields=['status'])
                return Response({'ok':False,'message':'El QR ha expirado.'},status=409)
            membership = get_object_or_404(BusinessMembership.objects.select_for_update(),
                business=business,customer_id=claim.customer_id)
            points=0
            metadata={}
            if claim.action_type in {'stamp_add','stamp_redeem'}:
                card=stamp_card(business,claim.customer,create=claim.action_type=='stamp_add')
                if claim.action_type=='stamp_add':
                    if card.current_stamps>=card.required_stamps:
                        invalid('La tarjeta ya esta completa.')
                    card.current_stamps+=1
                    points=10
                    event='stamp'
                else:
                    if card.current_stamps<card.required_stamps:
                        invalid('La tarjeta aun no esta completa.')
                    card.current_stamps=0
                    event='reward_redeem'
                card.updated_at=timezone.now()
                card.save(update_fields=['current_stamps','updated_at'])
            elif claim.action_type=='discount_redeem' and claim.payload.get('rewardId'):
                reward=eligible_reward(business,claim.customer,claim.payload['rewardId'],membership.points_balance)
                if reward.type!='discount':
                    invalid('Este beneficio requiere otro tipo de validacion.')
                event='reward_redeem'
                metadata={'reward_id':str(reward.id),'label':reward.name}
            else:
                campaign=eligible_campaign(business,claim.customer,claim.action_type,claim.payload.get('campaignId'))
                CampaignRedemption.objects.create(campaign=campaign,business=business,
                    customer=claim.customer,claim_request=claim)
                points=campaign.reward_points if claim.action_type=='points_boost' else 0
                event='mission_progress' if claim.action_type=='points_boost' else 'reward_redeem'
                metadata={'campaign_id':str(campaign.id)}
                if claim.action_type=='discount_redeem':
                    metadata['discount_percent']=campaign.discount_percent
            if points:
                membership.points_balance+=points
                membership.save(update_fields=['points_balance'])
            LoyaltyEvent.objects.create(business=business,customer=claim.customer,
                event_type=event,points_delta=points,metadata=metadata)
            claim.status='approved'; claim.approved_at=timezone.now()
            claim.save(update_fields=['status','approved_at'])
            audited(request.user,business)
        return Response({'ok':True,'message':'Validacion aplicada correctamente.'})
