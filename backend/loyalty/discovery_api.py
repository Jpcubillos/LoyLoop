"""Read models for discovery; private progress is always scoped to verified identity."""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from config.authentication import SupabaseAuthentication
from .api import ensure_customer
from .cutover import require_cutover
from .domain_services import segment
from .models import (Business, BusinessMembership, LoyaltyEvent, Reward,
                     Campaign, Mission, StampCard, CustomerMission,
                     RewardRedemption, CampaignRedemption, BusinessPlanAssignment)


class DiscoveryView(APIView):
    authentication_classes = [SupabaseAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, slug=None):
        require_cutover()
        # No customer_id/tenant supplied by clients is ever used to select progress.
        customer = ensure_customer(request.user) if request.user and request.user.is_authenticated else None
        now = timezone.now()

        inactive_biz_ids = BusinessPlanAssignment.objects.filter(
            status__in=['suspended', 'cancelled', 'inactive']
        ).values_list('business_id', flat=True)

        if slug:
            business = get_object_or_404(Business.objects.exclude(id__in=inactive_biz_ids), slug=slug)
            member = BusinessMembership.objects.filter(customer=customer, business=business).first() if customer else None
            user_segment = segment(business, customer) if (customer and member) else None
            member_points = member.points_balance if member else 0

            stamps = StampCard.objects.filter(customer=customer, business=business, active=True, reward_name='Cafe gratis con 10 sellos').first() if customer else None
            stamps_data = None
            if stamps:
                stamps_eligible = stamps.current_stamps >= stamps.required_stamps
                stamps_data = {
                    'id': str(stamps.id),
                    'reward_name': stamps.reward_name,
                    'current_stamps': stamps.current_stamps,
                    'required_stamps': stamps.required_stamps,
                    'active': stamps.active,
                    'eligible': stamps_eligible,
                    'condition': f"{stamps.current_stamps}/{stamps.required_stamps} sellos acumulados (sellos independientes de puntos)",
                    'updated_at': stamps.updated_at.isoformat() if stamps.updated_at else None,
                }

            membership_data = None
            if member:
                membership_data = {
                    'id': str(member.id),
                    'points_balance': member.points_balance,
                    'credit_balance_cents': member.credit_balance_cents,
                    'tier': member.tier,
                    'joined_at': member.joined_at.isoformat() if member.joined_at else None,
                }

            rewards_list = []
            for r in Reward.objects.filter(business=business, active=True).order_by('-created_at'):
                redemptions_count = RewardRedemption.objects.filter(reward=r).count()
                remaining_quota = max(0, r.redemption_limit - redemptions_count) if r.redemption_limit is not None else None
                quota_available = (r.redemption_limit is None or redemptions_count < r.redemption_limit)
                points_req = r.points_required or 0
                points_eligible = (member_points >= points_req) if member else False
                segment_eligible = (r.audience_segment == user_segment) if (customer and member) else False
                eligible = bool(member and segment_eligible and points_eligible and quota_available)
                condition = f"Requiere {points_req} puntos acumulados (no se descuentan)" if points_req > 0 else "Disponible para miembros"
                rewards_list.append({
                    'id': str(r.id),
                    'business_id': str(r.business_id),
                    'name': r.name,
                    'type': r.type,
                    'description': r.description,
                    'points_required': r.points_required,
                    'redemption_limit': r.redemption_limit,
                    'redemptions_count': redemptions_count,
                    'remaining_quota': remaining_quota,
                    'credit_amount_cents': r.credit_amount_cents,
                    'audience_segment': r.audience_segment,
                    'active': r.active,
                    'eligible': eligible,
                    'condition': condition,
                    'created_at': r.created_at.isoformat() if r.created_at else None,
                })

            campaigns_list = []
            for c in Campaign.objects.filter(business=business, active=True, status__in=['active', 'scheduled']).order_by('-created_at'):
                redemptions_count = CampaignRedemption.objects.filter(campaign=c).count()
                remaining_quota = max(0, c.redemption_limit - redemptions_count) if c.redemption_limit is not None else None
                quota_available = (c.redemption_limit is None or redemptions_count < c.redemption_limit)
                already_redeemed = CampaignRedemption.objects.filter(campaign=c, customer=customer).exists() if customer else False
                time_eligible = (c.status in {'active', 'scheduled'} and (c.starts_at is None or c.starts_at <= now) and (c.ends_at is None or c.ends_at > now))
                segment_eligible = (c.audience_segment == user_segment) if (customer and member) else False
                eligible = bool(member and segment_eligible and time_eligible and quota_available and not already_redeemed)
                condition = f"{c.discount_percent}% de descuento" if c.discount_percent else (f"+{c.reward_points} puntos" if c.reward_points else "Promoción especial")
                campaigns_list.append({
                    'id': str(c.id),
                    'business_id': str(c.business_id),
                    'name': c.name,
                    'type': c.type,
                    'description': c.description,
                    'discount_percent': c.discount_percent,
                    'reward_points': c.reward_points,
                    'redemption_limit': c.redemption_limit,
                    'redemptions_count': redemptions_count,
                    'remaining_quota': remaining_quota,
                    'already_redeemed': already_redeemed,
                    'status': c.status,
                    'audience_segment': c.audience_segment,
                    'duration_type': c.duration_type,
                    'starts_at': c.starts_at.isoformat() if c.starts_at else None,
                    'ends_at': c.ends_at.isoformat() if c.ends_at else None,
                    'active': c.active,
                    'eligible': eligible,
                    'condition': condition,
                    'created_at': c.created_at.isoformat() if c.created_at else None,
                })

            missions_list = []
            for m in Mission.objects.filter(business=business, active=True).order_by('-created_at'):
                time_eligible = (m.starts_at is None or m.starts_at <= now) and (m.ends_at is None or m.ends_at > now)
                segment_eligible = (m.audience_segment == user_segment) if (customer and member) else False
                eligible = bool(member and segment_eligible and time_eligible)
                condition = f"Meta: {m.goal} {'compras registradas' if m.category=='frequency' else 'acciones'} (+{m.reward_points} pts)"
                missions_list.append({
                    'id': str(m.id),
                    'business_id': str(m.business_id),
                    'name': m.name,
                    'category': m.category,
                    'description': m.description,
                    'goal': m.goal,
                    'reward_points': m.reward_points,
                    'audience_segment': m.audience_segment,
                    'duration_type': m.duration_type,
                    'starts_at': m.starts_at.isoformat() if m.starts_at else None,
                    'ends_at': m.ends_at.isoformat() if m.ends_at else None,
                    'active': m.active,
                    'eligible': eligible,
                    'condition': condition,
                    'created_at': m.created_at.isoformat() if m.created_at else None,
                })

            activity_list = list(LoyaltyEvent.objects.filter(
                customer=customer, business=business,
                event_type__in=['purchase', 'stamp', 'reward_redeem', 'mission_progress', 'minipay_payment']
            ).order_by('-created_at').values('id', 'business_id', 'event_type', 'points_delta', 'credit_delta_cents', 'metadata', 'created_at')[:20]) if customer else []

            return Response({
                'stamps': stamps_data,
                'membership': membership_data,
                'rewards': rewards_list,
                'campaigns': campaigns_list,
                'missions': missions_list,
                'progress': list(CustomerMission.objects.filter(customer=customer, mission__business=business).values('mission_id', 'progress', 'completed_at')) if customer else [],
                'activity': activity_list,
            })

        qs = Business.objects.exclude(id__in=inactive_biz_ids)

        q = (request.query_params.get('q') or request.query_params.get('search') or '').strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(category__icontains=q) | Q(description__icontains=q))

        category = (request.query_params.get('category') or '').strip()
        if category and category.lower() not in ('all', 'todos'):
            qs = qs.filter(category__iexact=category)

        member_map = {
            m.business_id: m for m in BusinessMembership.objects.filter(customer=customer)
        } if customer else {}

        membership_filter = (request.query_params.get('membership') or '').strip().lower()
        if membership_filter == 'member':
            qs = qs.filter(id__in=list(member_map.keys())) if customer else qs.none()
        elif membership_filter == 'non_member':
            qs = qs.exclude(id__in=list(member_map.keys())) if customer else qs

        qs = qs.order_by('name', 'id')

        total = qs.count()
        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except (ValueError, TypeError):
            page = 1
        try:
            page_size = max(1, min(int(request.query_params.get('page_size', 20)), 100))
        except (ValueError, TypeError):
            page_size = 20

        total_pages = (total + page_size - 1) // page_size if total > 0 else 1
        offset = (page - 1) * page_size
        paginated_qs = qs[offset:offset + page_size]

        catalog_data = []
        for b in paginated_qs:
            m = member_map.get(b.id)
            catalog_data.append({
                'id': str(b.id),
                'slug': b.slug,
                'name': b.name,
                'category': b.category,
                'description': b.description or '',
                'address': b.address or '',
                'city': b.city or '',
                'logo_url': b.logo_url,
                'is_available': True,
                'is_member': bool(m),
                'points_balance': m.points_balance if m else 0,
                'tier': m.tier if m else 'Miembro',
                'vip_purchase_threshold': b.vip_purchase_threshold,
                'at_risk_days': b.at_risk_days,
                'inactive_days': b.inactive_days,
            })

        return Response({
            'catalog': catalog_data,
            'pagination': {
                'page': page,
                'pageSize': page_size,
                'total': total,
                'totalPages': total_pages,
                'hasNext': offset + page_size < total,
                'hasPrev': page > 1,
            },
            'memberships': list(BusinessMembership.objects.filter(customer=customer).values('business_id', 'points_balance', 'tier')) if customer else [],
            'activity': list(LoyaltyEvent.objects.filter(
                customer=customer,
                event_type__in=['purchase', 'stamp', 'reward_redeem', 'mission_progress', 'minipay_payment']
            ).order_by('-created_at').values('business_id', 'event_type', 'points_delta', 'metadata', 'created_at')[:50]) if customer else [],
            'rewards': list(Reward.objects.filter(active=True).values('business_id', 'name', 'created_at')),
            'campaigns': list(Campaign.objects.filter(active=True, status='active').values('business_id', 'name', 'starts_at', 'ends_at', 'created_at'))
        })
