"""Read models for discovery; private progress is always scoped to verified identity."""
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from config.authentication import SupabaseAuthentication
from .api import ensure_customer
from .cutover import require_cutover
from .models import Business,BusinessMembership,LoyaltyEvent,Reward,Campaign,Mission,StampCard,CustomerMission

class DiscoveryView(APIView):
    authentication_classes=[SupabaseAuthentication]
    permission_classes=[AllowAny]
    def get(self,request,slug=None):
        require_cutover()
        # No customer_id/tenant supplied by clients is ever used to select progress.
        customer=ensure_customer(request.user) if request.user and request.user.is_authenticated else None
        if slug:
            business=get_object_or_404(Business,slug=slug)
            stamps=StampCard.objects.filter(customer=customer,business=business,active=True,reward_name='Cafe gratis con 10 sellos').first() if customer else None
            return Response({'stamps':({k:v for k,v in StampCard.objects.filter(pk=stamps.pk).values().first().items() if k!='customer_id'} if stamps else None),
                'rewards':list(Reward.objects.filter(business=business,active=True).values()),
                'campaigns':list(Campaign.objects.filter(business=business,active=True,status__in=['active','scheduled']).values()),
                'missions':list(Mission.objects.filter(business=business,active=True).values()),
                'progress':list(CustomerMission.objects.filter(customer=customer,mission__business=business).values('mission_id','progress','completed_at')) if customer else []})
        return Response({'catalog':list(Business.objects.order_by('-created_at','id').values('id','slug','name','category','description','address','logo_url','vip_purchase_threshold','at_risk_days','inactive_days')),
            'memberships':list(BusinessMembership.objects.filter(customer=customer).values('business_id','points_balance','tier')) if customer else [],
            'activity':list(LoyaltyEvent.objects.filter(customer=customer,event_type__in=['purchase','stamp','minipay_payment']).order_by('-created_at').values('business_id','event_type','created_at')) if customer else [],
            'rewards':list(Reward.objects.filter(active=True).values('business_id','name','created_at')),
            'campaigns':list(Campaign.objects.filter(active=True,status='active').values('business_id','name','starts_at','ends_at','created_at'))})
