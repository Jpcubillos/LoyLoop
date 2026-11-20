"""Authenticated business boundary; clients receive no database credentials."""
from django.db import transaction
from django.db.models.functions import Lower, Trim
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, MethodNotAllowed
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from config.authentication import SupabaseAuthentication
from config.audit import record_event
from .access import account_for, business_for
from .cutover import require_cutover
from .models import AppUser, CustomerIdentity, CustomerProfile, Reward, Mission, Campaign, Business


class AuthenticatedView(APIView):
    authentication_classes = [SupabaseAuthentication]
    permission_classes = [IsAuthenticated]

    def initial(self,request,*args,**kwargs):
        super().initial(request,*args,**kwargs)
        require_cutover()


class SessionView(AuthenticatedView):
    def get(self, request):
        account = account_for(request.user)
        owned = list(Business.objects.filter(owner_user_id=request.user.id).order_by('created_at','id')[:100])
        businesses = [{'id':str(b.id),'slug':b.slug,'name':b.name,'role':'owner'} for b in owned]
        if account and account.auth_user_id==request.user.id and account.account_type=='business' and account.business_id:
            if str(account.business_id) not in {b['id'] for b in businesses}:
                b=account.business
                businesses.append({'id':str(b.id),'slug':b.slug,'name':b.name,'role':account.business_role})
        selected=next((b for b in businesses if account and b['id']==str(account.business_id)),businesses[0] if businesses else None)
        return Response({'id':str(request.user.id),'email':request.user.email,
            'account_type':'business' if selected else account.account_type if account else None,
            'business_role':selected['role'] if selected else None,
            'business_id':selected['id'] if selected else None,
            'businesses':businesses,
            'active':bool(selected or account and account.active)})


def ensure_customer(principal):
    from django.db import connection
    with transaction.atomic():
        # Serialize both identity and legacy email adoption across devices.
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,39))',[str(principal.id)])
            cursor.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,40))',[principal.email])
        account = account_for(principal)  # Disabled/ambiguous accounts cannot bootstrap.
        identity = CustomerIdentity.objects.select_related('customer').filter(auth_user_id=principal.id).first()
        if identity:
            if identity.customer.email != principal.email:
                identity.customer.email = principal.email
                identity.customer.save(update_fields=['email'])
            profile = identity.customer
        else:
            profiles = list(CustomerProfile.objects.annotate(normalized_email=Lower(Trim('email'))).filter(normalized_email=principal.email).select_for_update()[:2])
            if len(profiles)>1:
                raise PermissionDenied('Tu perfil requiere revision.')
            profile = profiles[0] if profiles else CustomerProfile.objects.create(email=principal.email,full_name=principal.full_name)
            if CustomerIdentity.objects.filter(customer=profile).exists():
                raise PermissionDenied('Tu perfil requiere revision.')
            CustomerIdentity.objects.create(auth_user_id=principal.id,customer=profile)
        if account is None:
            AppUser.objects.create(email=principal.email,auth_user_id=principal.id,
                full_name=profile.full_name,account_type='customer',customer=profile,
                active=True,business_role=None,customer_segment=None)
        elif account.account_type=='customer':
            if account.customer_id not in (None,profile.id):
                raise PermissionDenied('Tu perfil requiere revision.')
            account.auth_user_id = principal.id
            account.customer = profile
            account.email = principal.email
            account.save(update_fields=['auth_user','customer','email'])
        return profile


class CustomerIdentityView(AuthenticatedView):
    def post(self, request):
        if request.data:
            raise serializers.ValidationError('Esta accion no admite identidades enviadas por el cliente.')
        profile = ensure_customer(request.user)
        return Response({'customer_id':str(profile.id)})


class StrictSerializer(serializers.ModelSerializer):
    def to_internal_value(self, data):
        if (not isinstance(data,dict) or set(data)-set(self.fields)
                or any(name in data and field.read_only for name,field in self.fields.items())):
            raise serializers.ValidationError({'non_field_errors':['El registro contiene campos no admitidos.']})
        return super().to_internal_value(data)


class RewardSerializer(StrictSerializer):
    type = serializers.ChoiceField(choices=['discount','points','credit','product'])
    audience_segment = serializers.ChoiceField(choices=['inactive','at_risk','active','vip'],required=False)
    points_required = serializers.IntegerField(min_value=0,allow_null=True,required=False)
    credit_amount_cents = serializers.IntegerField(min_value=0,allow_null=True,required=False)
    class Meta:
        model = Reward
        fields = ['id','name','type','description','points_required','credit_amount_cents','audience_segment','active']
        read_only_fields = ['id']


class MissionSerializer(StrictSerializer):
    category = serializers.ChoiceField(choices=['frequency','referral','offpeak','minipay','review'])
    audience_segment = serializers.ChoiceField(choices=['inactive','at_risk','active','vip'],required=False)
    duration_type = serializers.ChoiceField(choices=['indefinite','one_hour','custom'],required=False)
    goal = serializers.IntegerField(min_value=1,required=False)
    reward_points = serializers.IntegerField(min_value=0,required=False)
    class Meta:
        model = Mission
        fields = ['id','name','category','description','goal','reward_points','audience_segment','duration_type','starts_at','ends_at','active']
        read_only_fields = ['id']


class CampaignSerializer(StrictSerializer):
    type = serializers.ChoiceField(choices=['discount_redeem','points_boost'])
    audience_segment = serializers.ChoiceField(choices=['inactive','at_risk','active','vip'],required=False)
    duration_type = serializers.ChoiceField(choices=['indefinite','one_hour','custom'],required=False)
    discount_percent = serializers.IntegerField(min_value=1,max_value=100,allow_null=True,required=False)
    reward_points = serializers.IntegerField(min_value=0,required=False)
    status = serializers.ChoiceField(choices=['active','scheduled','ended'],required=False)
    class Meta:
        model = Campaign
        fields = ['id','name','type','description','discount_percent','reward_points','audience_segment','duration_type','starts_at','ends_at','status','active']
        read_only_fields = ['id']


OFFERS = {'rewards':(Reward,RewardSerializer),'missions':(Mission,MissionSerializer),'campaigns':(Campaign,CampaignSerializer)}


class OffersView(AuthenticatedView):
    def context(self, request, business_id, collection):
        if collection not in OFFERS:
            from django.http import Http404
            raise Http404()
        business = business_for(request.user,business_id,{'owner','manager'})
        return business, *OFFERS[collection]

    def get(self, request, business_id, collection, item_id=None):
        business,model,serializer = self.context(request,business_id,collection)
        rows = model.objects.filter(business=business).order_by('-created_at','id')
        if item_id:
            return Response(serializer(get_object_or_404(rows,pk=item_id)).data)
        return Response(serializer(rows[:100],many=True).data)

    def post(self, request, business_id, collection, item_id=None):
        if item_id:
            raise MethodNotAllowed('POST')
        business,model,serializer = self.context(request,business_id,collection)
        value = serializer(data=request.data)
        value.is_valid(raise_exception=True)
        with transaction.atomic():
            item = value.save(business=business)
            transaction.on_commit(lambda: record_event(event='business_action',outcome='success',actor_id=request.user.id,tenant_id=business.id))
        return Response(serializer(item).data,status=201)

    def patch(self, request, business_id, collection, item_id=None):
        if not item_id:
            raise MethodNotAllowed('PATCH')
        business,model,serializer = self.context(request,business_id,collection)
        with transaction.atomic():
            item = get_object_or_404(model.objects.select_for_update(),pk=item_id,business=business)
            value = serializer(item,data=request.data,partial=True)
            value.is_valid(raise_exception=True)
            value.save()
            transaction.on_commit(lambda: record_event(event='business_action',outcome='success',actor_id=request.user.id,tenant_id=business.id))
        return Response(value.data)

    def delete(self, request, business_id, collection, item_id=None):
        if not item_id:
            raise MethodNotAllowed('DELETE')
        business,model,serializer = self.context(request,business_id,collection)
        with transaction.atomic():
            item = get_object_or_404(model.objects.select_for_update(),pk=item_id,business=business)
            item.delete()
            transaction.on_commit(lambda: record_event(event='business_action',outcome='success',actor_id=request.user.id,tenant_id=business.id))
        return Response(status=204)
