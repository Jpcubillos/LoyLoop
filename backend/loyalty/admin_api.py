"""Tenant administration and platform approval, never inferred from client roles."""
from django.db import connection, transaction
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from .access import account_for, business_for
from .api import AuthenticatedView, StrictSerializer
from .cutover import require_cutover
from .customer_api import strict, invalid, audited
from .models import AppUser, Business, BusinessLead, PlatformBusinessApprover


def confirmed_auth(email, required=True):
    with connection.cursor() as cursor:
        cursor.execute('SELECT public.loyloop_confirmed_auth_user(%s)',[email])
        result=cursor.fetchone()[0]
    if result is None and required:
        invalid('El correo debe pertenecer a una cuenta confirmada y unica.')
    return result


class LeadSerializer(StrictSerializer):
    owner_name=serializers.CharField(max_length=120)
    business_name=serializers.CharField(max_length=160)
    email=serializers.EmailField(max_length=254)
    phone=serializers.CharField(max_length=40,required=False,allow_blank=True)
    city=serializers.CharField(max_length=120,required=False,allow_blank=True)
    category=serializers.CharField(max_length=120,required=False,allow_blank=True)
    message=serializers.CharField(max_length=3000,required=False,allow_blank=True)
    class Meta:
        model=BusinessLead
        fields=['id','owner_name','business_name','email','phone','city','category','message','status','business_id','created_at']
        read_only_fields=['id','status','business_id','created_at']


class LeadThrottle(AnonRateThrottle):
    rate='5/hour'


class PublicLeadView(APIView):
    authentication_classes=[]
    permission_classes=[AllowAny]
    throttle_classes=[LeadThrottle]
    def initial(self,request,*args,**kwargs):
        super().initial(request,*args,**kwargs)
        require_cutover()
    def post(self,request):
        serializer=LeadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(email=serializer.validated_data['email'].strip().lower())
        return Response({'ok':True},status=201)


def approver(principal):
    account_for(principal)
    if not PlatformBusinessApprover.objects.filter(user_id=principal.id).exists():
        raise PermissionDenied('No tienes permiso para aprobar comercios.')


class LeadsView(AuthenticatedView):
    def get(self,request):
        approver(request.user)
        return Response(LeadSerializer(BusinessLead.objects.order_by('-created_at')[:100],many=True).data)

    def post(self,request,lead_id):
        approver(request.user)
        strict(request.data,[])
        with transaction.atomic():
            lead=get_object_or_404(BusinessLead.objects.select_for_update(),pk=lead_id)
            if lead.business_id:
                return Response({'business_id':str(lead.business_id)})
            if lead.status=='rejected':
                invalid('Una solicitud rechazada no se puede aprobar.')
            # Publication can precede signup; never grant ownership to an
            # unconfirmed identity merely because its email matches a lead.
            owner=confirmed_auth(lead.email.strip().lower(),required=False)
            business=Business.objects.create(
                slug=(slugify(lead.business_name) or 'comercio')+'-'+lead.id.hex[:8],
                name=lead.business_name.strip(),category=lead.category or 'Otros',
                description=lead.message or None,city=lead.city or None,
                address=lead.city or None,owner_user_id=owner)
            lead.status='approved';lead.business=business
            lead.save(update_fields=['status','business'])
            audited(request.user,business)
        return Response({'business_id':str(business.id)},status=201)


class SegmentationSerializer(serializers.Serializer):
    vip_purchase_threshold=serializers.IntegerField(min_value=1,max_value=100000)
    at_risk_days=serializers.IntegerField(min_value=1,max_value=100000)
    inactive_days=serializers.IntegerField(min_value=1,max_value=100000)
    def validate(self,data):
        if data['inactive_days']<=data['at_risk_days']:
            invalid('Los dias de inactividad deben superar los dias en riesgo.')
        return data


class SegmentationView(AuthenticatedView):
    def patch(self,request,business_id):
        business=business_for(request.user,business_id,{'owner'})
        strict(request.data,SegmentationSerializer().fields)
        serializer=SegmentationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            for key,value in serializer.validated_data.items():
                setattr(business,key,value)
            business.save(update_fields=list(serializer.validated_data))
            audited(request.user,business)
        return Response(serializer.data)


class StaffSerializer(StrictSerializer):
    email=serializers.EmailField(max_length=254)
    full_name=serializers.CharField(max_length=160)
    business_role=serializers.ChoiceField(choices=['owner','manager','cashier'])
    class Meta:
        model=AppUser
        fields=['id','email','full_name','business_role','active']
        read_only_fields=['id']


class StaffView(AuthenticatedView):
    def get(self,request,business_id):
        business=business_for(request.user,business_id,{'owner'})
        return Response(StaffSerializer(AppUser.objects.filter(business=business,account_type='business').order_by('id')[:100],many=True).data)

    def post(self,request,business_id):
        business=business_for(request.user,business_id,{'owner'})
        serializer=StaffSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email=serializer.validated_data['email'].strip().lower()
        auth_id=confirmed_auth(email)
        with transaction.atomic():
            # Do not silently move a customer or another merchant's employee.
            with connection.cursor() as cursor:
                cursor.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,39))',[str(auth_id)])
            if AppUser.objects.filter(auth_user_id=auth_id).exists() or AppUser.objects.filter(email__iexact=email).exists():
                invalid('La cuenta ya tiene un perfil. Edita su acceso existente.')
            item=serializer.save(email=email,auth_user_id=auth_id,account_type='business',business=business)
            audited(request.user,business)
        return Response(StaffSerializer(item).data,status=201)

    def patch(self,request,business_id,item_id):
        business=business_for(request.user,business_id,{'owner'})
        strict(request.data,['full_name','business_role','active'])
        with transaction.atomic():
            # Lock the tenant before staff rows to serialize owner changes.
            Business.objects.select_for_update().get(pk=business.pk)
            item=get_object_or_404(AppUser.objects.select_for_update(),pk=item_id,business=business,account_type='business')
            if item.auth_user_id==business.owner_user_id and (
                    request.data.get('active') is False or request.data.get('business_role',item.business_role)!='owner'):
                invalid('Transfiere la propiedad antes de desactivar al propietario.')
            if item.active and item.business_role=='owner' and (
                    request.data.get('active') is False or request.data.get('business_role',item.business_role)!='owner'):
                if not business.owner_user_id and not AppUser.objects.filter(
                        business=business,active=True,business_role='owner',auth_user__isnull=False).exclude(pk=item.pk).exists():
                    invalid('El comercio debe conservar al menos un propietario activo.')
            serializer=StaffSerializer(item,data=request.data,partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            audited(request.user,business)
        return Response(serializer.data)
