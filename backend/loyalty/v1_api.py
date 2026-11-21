"""LL domain API v1. Client input never supplies a trusted role, actor or tenant.

Existing /api/ routes remain supported through loyalty.urls. This module adds
stable, versioned contracts for the domain services delivered in this HU.
"""
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, MethodNotAllowed
from rest_framework.response import Response
from .throttles import PrincipalScopedThrottle

from .access import account_for, business_for
from .admin_api import approver
from .api import AuthenticatedView, ensure_customer
from .cutover import require_domain
from .domain_services import (invalid, strict, record_confirmed_activity,
    activity_result, issue_identification, consume_identification, audit_success,
    get_active_award_rule, set_business_award_rule, reverse_confirmed_activity)
from .models import (ActivityReceipt, Business, BusinessMembership,
    BusinessPlanAssignment, CustomerProfile, IdentityChallenge, LoyaltyEvent,
    PlatformBusinessApprover, StampCard, StampCompletion, BusinessAwardRule)


class DomainView(AuthenticatedView):
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        require_domain()


def customer_for(principal):
    account = account_for(principal)
    if account and account.account_type != 'customer':
        raise PermissionDenied('La cuenta no tiene acceso al espacio del cliente.')
    return ensure_customer(principal)


class MyProfileView(DomainView):
    def get(self, request):
        customer = customer_for(request.user)
        return Response({'id':str(customer.id), 'fullName':customer.full_name,
                         'email':customer.email, 'phone':customer.phone})

    def patch(self, request):
        strict(request.data, ['fullName','phone'])
        class Update(serializers.Serializer):
            fullName = serializers.CharField(min_length=1, max_length=160, trim_whitespace=True, required=False)
            phone = serializers.CharField(max_length=40, allow_blank=True, allow_null=True, required=False)
        serializer = Update(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data:
            invalid('Indica un campo para actualizar.')
        with transaction.atomic():
            customer = customer_for(request.user)
            customer = CustomerProfile.objects.select_for_update().get(pk=customer.pk)
            fields = []
            if 'fullName' in serializer.validated_data:
                customer.full_name = serializer.validated_data['fullName']
                fields.append('full_name')
            if 'phone' in serializer.validated_data:
                customer.phone = serializer.validated_data['phone'] or None
                fields.append('phone')
            customer.save(update_fields=fields)
        return self.get(request)


class BusinessCatalogView(DomainView):
    def get(self, request, business_id=None):
        fields = ('id','slug','name','category','description','address','city','logo_url')
        if business_id:
            business = get_object_or_404(Business, pk=business_id)
            plan = BusinessPlanAssignment.objects.filter(business_id=business.id).first()
            data = {field: str(getattr(business,field)) if field=='id'
                    else getattr(business,field) for field in fields}
            data['status'] = plan.status if plan else ('active' if business.owner_user_id else 'trial')
            return Response(data)
        return Response([{'id':str(item['id']),**{k:v for k,v in item.items() if k!='id'}}
                         for item in Business.objects.order_by('name','id').values(*fields)[:100]])

    def patch(self, request, business_id):
        business = business_for(request.user, business_id, {'owner'})
        allowed = {'name', 'category', 'description', 'address', 'city', 'logo_url'}
        strict(request.data, allowed)

        class BusinessUpdateSerializer(serializers.Serializer):
            name = serializers.CharField(max_length=160, required=False)
            category = serializers.CharField(max_length=120, required=False)
            description = serializers.CharField(max_length=3000, required=False, allow_blank=True, allow_null=True)
            address = serializers.CharField(max_length=300, required=False, allow_blank=True, allow_null=True)
            city = serializers.CharField(max_length=120, required=False, allow_blank=True, allow_null=True)
            logo_url = serializers.CharField(max_length=500, required=False, allow_blank=True, allow_null=True)

            def validate_name(self, value):
                if value is not None and not value.strip():
                    invalid('El nombre del comercio no puede estar vacio.')
                return value.strip() if value else value

            def validate_category(self, value):
                if value is not None and not value.strip():
                    invalid('La categoria no puede estar vacia.')
                return value.strip() if value else value

        serializer = BusinessUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data:
            invalid('No se enviaron datos para actualizar.')

        with transaction.atomic():
            b = Business.objects.select_for_update().get(pk=business.pk)
            for k, v in serializer.validated_data.items():
                setattr(b, k, v)
            b.save(update_fields=list(serializer.validated_data.keys()))
            audited(request.user, b)

        fields = ('id','slug','name','category','description','address','city','logo_url')
        plan = BusinessPlanAssignment.objects.filter(business_id=business.id).first()
        data = {field: str(getattr(b, field)) if field == 'id' else getattr(b, field) for field in fields}
        data['status'] = plan.status if plan else ('active' if b.owner_user_id else 'trial')
        return Response(data)


class MyMembershipsView(DomainView):
    def get(self, request):
        customer = customer_for(request.user)
        rows = BusinessMembership.objects.filter(customer=customer).select_related('business').order_by('business__name','pk')[:100]
        return Response([{'id':str(item.id),'businessId':str(item.business_id),
                          'businessName':item.business.name,'pointsAccumulated':item.points_balance,
                          'tier':item.tier, 'joinedAt':item.joined_at.isoformat()}
                         for item in rows])


class MerchantMembershipsView(DomainView):
    def get(self, request, business_id):
        business = business_for(request.user,business_id,{'owner','manager'})
        rows = BusinessMembership.objects.filter(business=business).select_related('customer').order_by('joined_at','pk')[:100]
        return Response([{'id':str(item.id),'customerName':item.customer.full_name,
                          'pointsAccumulated':item.points_balance, 'tier':item.tier,
                          'joinedAt':item.joined_at.isoformat()} for item in rows])


class MyPointsView(DomainView):
    def get(self, request):
        customer = customer_for(request.user)
        members = BusinessMembership.objects.filter(customer=customer).select_related('business').order_by('business_id')[:100]
        events = LoyaltyEvent.objects.filter(customer=customer).order_by('-created_at','id')[:100]
        return Response({'memberships':[{'businessId':str(m.business_id),'pointsAccumulated':m.points_balance,
                       'tier':m.tier} for m in members],
            'events':[{'id':str(e.id),'businessId':str(e.business_id),
                      'type':e.event_type,'pointsDelta':e.points_delta,
                      'createdAt':e.created_at.isoformat()} for e in events]})


class MerchantPointsView(DomainView):
    def post(self, request, business_id):
        # Tenant/role authorization must precede payload parsing and validation.
        # Unauthorized customers receive 403 even if the body is incomplete.
        business = business_for(request.user, business_id, {'owner','manager','cashier'})
        strict(request.data, ['membershipId','pointsAwarded','stampsAdded','stampCardId','reason'])
        class Activity(serializers.Serializer):
            membershipId = serializers.UUIDField()
            pointsAwarded = serializers.IntegerField(min_value=0, max_value=100000, required=False, allow_null=True)
            stampsAdded = serializers.IntegerField(min_value=0, max_value=20, default=0, required=False, allow_null=True)
            stampCardId = serializers.UUIDField(required=False, allow_null=True)
            reason = serializers.CharField(min_length=5, max_length=200, trim_whitespace=True)
        serializer = Activity(data=request.data)
        serializer.is_valid(raise_exception=True)
        key = request.headers.get('Idempotency-Key')
        if not key:
            invalid('Se requiere Idempotency-Key para registrar actividad.')
        value = serializer.validated_data
        receipt, created = record_confirmed_activity(business=business,
            membership_id=value['membershipId'], actor_id=request.user.id, reference=key,
            points=value.get('pointsAwarded'), stamps=value.get('stampsAdded'),
            card_id=value.get('stampCardId'), reason=value['reason'])
        return Response(activity_result(receipt), status=201 if created else 200)

    def get(self, request, business_id):
        business = business_for(request.user, business_id, {'owner','manager'})
        rows = ActivityReceipt.objects.filter(business=business).order_by('-created_at','id')[:100]
        return Response([{'id': str(row.id), 'membershipCustomerId': str(row.customer_id),
                          'pointsAwarded': row.points_awarded, 'stampsAwarded': row.stamps_awarded,
                          'ruleVersion': row.rule_version,
                          'reversed': bool(row.reversed_at),
                          'reversedAt': row.reversed_at.isoformat() if row.reversed_at else None,
                          'reversalReason': row.reversal_reason,
                          'createdAt': row.created_at.isoformat()} for row in rows])


class BusinessAwardRulesView(DomainView):
    def get(self, request, business_id):
        business = business_for(request.user, business_id, {'owner','manager','cashier'})
        rule = get_active_award_rule(business)
        return Response({
            'pointsPerPurchase': rule.points_per_purchase,
            'stampsPerPurchase': rule.stamps_per_purchase,
            'stampsEnabled': rule.stamps_enabled,
            'minPurchaseCents': rule.min_purchase_cents,
            'version': rule.version,
            'effectiveFrom': rule.effective_from.isoformat() if rule.effective_from else None,
        })

    def put(self, request, business_id):
        business = business_for(request.user, business_id, {'owner','manager'})
        strict(request.data, ['pointsPerPurchase','stampsPerPurchase','stampsEnabled','minPurchaseCents'])
        class AwardRuleInput(serializers.Serializer):
            pointsPerPurchase = serializers.IntegerField(min_value=0, max_value=100000)
            stampsPerPurchase = serializers.IntegerField(min_value=0, max_value=20)
            stampsEnabled = serializers.BooleanField(default=True)
            minPurchaseCents = serializers.IntegerField(min_value=0, default=0, required=False)
        s = AwardRuleInput(data=request.data)
        s.is_valid(raise_exception=True)
        val = s.validated_data
        rule = set_business_award_rule(
            business=business,
            points_per_purchase=val['pointsPerPurchase'],
            stamps_per_purchase=val['stampsPerPurchase'],
            stamps_enabled=val['stampsEnabled'],
            min_purchase_cents=val.get('minPurchaseCents', 0),
            actor_id=request.user.id
        )
        return Response({
            'ok': True,
            'pointsPerPurchase': rule.points_per_purchase,
            'stampsPerPurchase': rule.stamps_per_purchase,
            'stampsEnabled': rule.stamps_enabled,
            'minPurchaseCents': rule.min_purchase_cents,
            'version': rule.version,
            'effectiveFrom': rule.effective_from.isoformat() if rule.effective_from else None,
        })


class ReverseActivityView(DomainView):
    def post(self, request, business_id, receipt_id):
        business = business_for(request.user, business_id, {'owner','manager'})
        strict(request.data, ['reason'])
        reason = request.data.get('reason', '')
        result = reverse_confirmed_activity(business=business, receipt_id=receipt_id, actor_id=request.user.id, reason=reason)
        return Response(result, status=200)


class MyStampCardsView(DomainView):
    def get(self, request):
        customer = customer_for(request.user)
        cards = StampCard.objects.filter(customer=customer).order_by('business_id','pk')[:100]
        return Response([{'id':str(card.id),'businessId':str(card.business_id),
            'rewardName':card.reward_name,'currentStamps':card.current_stamps,
            'requiredStamps':card.required_stamps,'active':card.active,
            'completedCycles':StampCompletion.objects.filter(card=card).count()} for card in cards])


class MerchantStampCardsView(DomainView):
    def get(self, request, business_id):
        business = business_for(request.user,business_id,{'owner','manager'})
        cards = StampCard.objects.filter(business=business).order_by('customer_id','id')[:100]
        return Response([{'id':str(card.id),'customerId':str(card.customer_id),
            'rewardName':card.reward_name,'currentStamps':card.current_stamps,
            'requiredStamps':card.required_stamps,'active':card.active} for card in cards])

    def post(self, request, business_id):
        business=business_for(request.user,business_id,{'owner','manager'})
        strict(request.data,['membershipId','rewardName','requiredStamps'])
        class StampData(serializers.Serializer):
            membershipId=serializers.UUIDField()
            rewardName=serializers.CharField(max_length=160,min_length=2,trim_whitespace=True)
            requiredStamps=serializers.IntegerField(min_value=1,max_value=100)
        value=StampData(data=request.data)
        value.is_valid(raise_exception=True)
        with transaction.atomic():
            membership=get_object_or_404(BusinessMembership.objects.select_for_update(),
                pk=value.validated_data['membershipId'],business=business)
            card, created = StampCard.objects.get_or_create(business=business,
                customer_id=membership.customer_id,reward_name=value.validated_data['rewardName'],
                defaults={'required_stamps':value.validated_data['requiredStamps']})
            if not created and card.required_stamps != value.validated_data['requiredStamps']:
                invalid('Ya existe esta tarjeta con un objetivo diferente.')
            if created:
                audit_success(request.user.id,business.id)
        return Response({'id':str(card.id),'requiredStamps':card.required_stamps},
                        status=201 if created else 200)


class IdentityIssueView(DomainView):
    throttle_classes = [PrincipalScopedThrottle]
    throttle_scope = 'loyloop_identity'

    def post(self, request):
        strict(request.data,['businessId'])
        class Selector(serializers.Serializer):
            businessId=serializers.UUIDField()
        value=Selector(data=request.data)
        value.is_valid(raise_exception=True)
        customer=customer_for(request.user)
        business=get_object_or_404(Business,pk=value.validated_data['businessId'])
        return Response(issue_identification(business=business, customer=customer),status=201)


class IdentityVerifyView(DomainView):
    throttle_classes = [PrincipalScopedThrottle]
    throttle_scope = 'loyloop_identity'

    def post(self, request, business_id):
        business=business_for(request.user,business_id,{'owner','manager','cashier'})
        strict(request.data,['code'])
        return Response(consume_identification(business=business,
                                               operator_id=request.user.id,
                                               submitted_code=request.data.get('code')))


PLAN_CODES=('STARTER','GROWTH','PRO')


class PlanCatalogView(DomainView):
    def get(self, request):
        # No price/feature entitlements were commercially approved for the MVP.
        return Response([{'code':name,'billing':'manual','price':None} for name in PLAN_CODES])


class BusinessPlanView(DomainView):
    def get(self,request,business_id):
        if not PlatformBusinessApprover.objects.filter(user_id=request.user.id).exists():
            business_for(request.user,business_id,{'owner','manager'})
        else:
            account_for(request.user)
            get_object_or_404(Business,pk=business_id)
        plan=BusinessPlanAssignment.objects.filter(business_id=business_id).first()
        return Response({'businessId':str(business_id),'planCode':plan.plan_code if plan else None,
                         'status':plan.status if plan else 'unassigned'})

    def put(self,request,business_id):
        approver(request.user)
        business=get_object_or_404(Business,pk=business_id)
        strict(request.data,['planCode','status'])
        class PlanData(serializers.Serializer):
            planCode=serializers.ChoiceField(choices=PLAN_CODES)
            status=serializers.ChoiceField(choices=('trial','active','suspended','cancelled'))
        value=PlanData(data=request.data)
        value.is_valid(raise_exception=True)
        with transaction.atomic():
            Business.objects.select_for_update().get(pk=business.pk)
            plan,created=BusinessPlanAssignment.objects.update_or_create(
                business=business,defaults={'plan_code':value.validated_data['planCode'],
                    'status':value.validated_data['status'],
                    'updated_by':request.user.id,'updated_at':timezone.now()})
            audit_success(request.user.id,business.id)
        return Response({'businessId':str(business.id),'planCode':plan.plan_code,
                         'status':plan.status},status=201 if created else 200)


class PlatformOverviewView(DomainView):
    def get(self,request):
        approver(request.user)
        return Response({'businessCount':Business.objects.count(),
                         'membershipCount':BusinessMembership.objects.count(),
                         'planAssignmentCount':BusinessPlanAssignment.objects.count(),
                         'activityReceiptCount':ActivityReceipt.objects.count()})
