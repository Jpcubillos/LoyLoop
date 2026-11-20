"""Business schema baseline. Adoption of an existing Supabase requires drift review."""
import uuid
from django.db import models
from django.contrib.postgres.functions import RandomUUID, TransactionNow
from django.db.models import Q
from django.db.models.functions import Lower, Trim
from django.utils import timezone

class SupabaseAuthUser(models.Model):
    id = models.UUIDField(primary_key=True)
    class Meta:
        managed = False
        db_table = '"auth"."users"'

class Business(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, db_default=RandomUUID())
    slug = models.TextField(unique=True)
    name = models.TextField()
    category = models.TextField()
    description = models.TextField(null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    city = models.TextField(null=True, blank=True)
    logo_url = models.TextField(null=True, blank=True)
    qr_code_url = models.TextField(null=True, blank=True)
    vip_purchase_threshold = models.IntegerField(default=30, db_default=30)
    at_risk_days = models.IntegerField(default=90, db_default=90)
    inactive_days = models.IntegerField(default=180, db_default=180)
    owner_user = models.ForeignKey('SupabaseAuthUser', on_delete=models.SET_NULL, db_column='owner_user_id', null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    class Meta:
        db_table = 'businesses'
        constraints = [
            models.CheckConstraint(condition=Q(vip_purchase_threshold__gt=0), name='businesses_vip_purchase_threshold_check'),
            models.CheckConstraint(condition=Q(at_risk_days__gt=0), name='businesses_at_risk_days_check'),
            models.CheckConstraint(condition=Q(inactive_days__gt=0), name='businesses_inactive_days_check'),
        ]
        indexes = [
            models.Index(fields=['slug'], name='businesses_slug_idx'),
        ]

class CustomerProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, db_default=RandomUUID())
    full_name = models.TextField()
    phone = models.TextField(null=True, blank=True, unique=True)
    email = models.TextField(null=True, blank=True, unique=True)
    wallet_address = models.TextField(null=True, blank=True, unique=True)
    created_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    class Meta:
        db_table = 'customer_profiles'
        constraints = [
            models.UniqueConstraint(Lower(Trim('email')), condition=Q(email__isnull=False), name='customer_profiles_normalized_email_key'),
        ]

class AppUser(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, db_default=RandomUUID())
    auth_user = models.OneToOneField('SupabaseAuthUser', on_delete=models.CASCADE, db_column='auth_user_id', null=True, blank=True)
    email = models.TextField(unique=True)
    full_name = models.TextField()
    account_type = models.TextField()
    business = models.ForeignKey('Business', on_delete=models.CASCADE, db_column='business_id', null=True, blank=True)
    customer = models.ForeignKey('CustomerProfile', on_delete=models.CASCADE, db_column='customer_id', null=True, blank=True)
    business_role = models.TextField(null=True, blank=True)
    customer_segment = models.TextField(null=True, blank=True)
    active = models.BooleanField(default=True, db_default=True)
    created_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    class Meta:
        db_table = 'app_users'
        constraints = [
            models.CheckConstraint(condition=Q(account_type__in=['business', 'customer']), name='app_users_account_type_check'),
            models.CheckConstraint(condition=(Q(business_role__isnull=True) | Q(business_role__in=['owner', 'manager', 'cashier'])), name='app_users_business_role_check'),
            models.CheckConstraint(condition=(Q(customer_segment__isnull=True) | Q(customer_segment__in=['inactive', 'at_risk', 'active', 'vip'])), name='app_users_customer_segment_check'),
        ]
        indexes = [
            models.Index(fields=['email'], name='app_users_email_idx'),
            models.Index(fields=['business'], name='app_users_business_idx'),
        ]

class BusinessLead(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, db_default=RandomUUID())
    owner_name = models.TextField()
    business_name = models.TextField()
    email = models.TextField()
    phone = models.TextField(null=True, blank=True)
    city = models.TextField(null=True, blank=True)
    category = models.TextField(null=True, blank=True)
    message = models.TextField(null=True, blank=True)
    status = models.TextField(default='new', db_default='new')
    created_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    business = models.OneToOneField('Business', on_delete=models.PROTECT, null=True, blank=True, db_column='business_id')
    class Meta:
        db_table = 'business_leads'
        constraints = [
            models.CheckConstraint(condition=Q(status__in=['new', 'contacted', 'approved', 'rejected']), name='business_leads_status_check'),
        ]
        indexes = [
            models.Index(fields=['status'], name='business_leads_status_idx'),
        ]

class BusinessMembership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, db_default=RandomUUID())
    business = models.ForeignKey('Business', on_delete=models.CASCADE, db_column='business_id')
    customer = models.ForeignKey('CustomerProfile', on_delete=models.CASCADE, db_column='customer_id')
    points_balance = models.IntegerField(default=0, db_default=0)
    credit_balance_cents = models.IntegerField(default=0, db_default=0)
    tier = models.TextField(default='Nuevo', db_default='Nuevo')
    joined_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    class Meta:
        db_table = 'business_memberships'
        constraints = [
            models.CheckConstraint(condition=Q(points_balance__gte=0), name='business_memberships_points_balance_check'),
            models.CheckConstraint(condition=Q(credit_balance_cents__gte=0), name='business_memberships_credit_balance_cents_check'),
            models.UniqueConstraint(fields=['business', 'customer'], name='business_memberships_natural_key'),
        ]
        indexes = [
            models.Index(fields=['business'], name='memberships_business_idx'),
            models.Index(fields=['customer'], name='memberships_customer_idx'),
        ]

class Reward(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, db_default=RandomUUID())
    business = models.ForeignKey('Business', on_delete=models.CASCADE, db_column='business_id')
    name = models.TextField()
    type = models.TextField()
    description = models.TextField(null=True, blank=True)
    points_required = models.IntegerField(null=True, blank=True)
    credit_amount_cents = models.IntegerField(null=True, blank=True)
    audience_segment = models.TextField(default='active', db_default='active')
    active = models.BooleanField(default=True, db_default=True)
    created_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    class Meta:
        db_table = 'rewards'
        constraints = [
            models.CheckConstraint(condition=Q(type__in=['discount', 'points', 'credit', 'product']), name='rewards_type_check'),
            models.CheckConstraint(condition=(Q(points_required__isnull=True) | Q(points_required__gte=0)), name='rewards_points_required_check'),
            models.CheckConstraint(condition=(Q(credit_amount_cents__isnull=True) | Q(credit_amount_cents__gte=0)), name='rewards_credit_amount_cents_check'),
            models.CheckConstraint(condition=Q(audience_segment__in=['inactive', 'at_risk', 'active', 'vip']), name='rewards_audience_segment_check'),
        ]
        indexes = [
            models.Index(fields=['business'], name='rewards_business_idx'),
        ]

class Mission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, db_default=RandomUUID())
    business = models.ForeignKey('Business', on_delete=models.CASCADE, db_column='business_id')
    name = models.TextField()
    category = models.TextField()
    description = models.TextField(null=True, blank=True)
    goal = models.IntegerField(default=1, db_default=1)
    reward_points = models.IntegerField(default=0, db_default=0)
    audience_segment = models.TextField(default='active', db_default='active')
    duration_type = models.TextField(default='indefinite', db_default='indefinite')
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    active = models.BooleanField(default=True, db_default=True)
    created_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    class Meta:
        db_table = 'missions'
        constraints = [
            models.CheckConstraint(condition=Q(category__in=['frequency', 'referral', 'offpeak', 'minipay', 'review']), name='missions_category_check'),
            models.CheckConstraint(condition=Q(goal__gt=0), name='missions_goal_check'),
            models.CheckConstraint(condition=Q(reward_points__gte=0), name='missions_reward_points_check'),
            models.CheckConstraint(condition=Q(audience_segment__in=['inactive', 'at_risk', 'active', 'vip']), name='missions_audience_segment_check'),
            models.CheckConstraint(condition=Q(duration_type__in=['indefinite', 'one_hour', 'custom']), name='missions_duration_type_check'),
        ]
        indexes = [
            models.Index(fields=['business'], name='missions_business_idx'),
        ]

class Campaign(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, db_default=RandomUUID())
    business = models.ForeignKey('Business', on_delete=models.CASCADE, db_column='business_id')
    name = models.TextField()
    type = models.TextField()
    description = models.TextField(null=True, blank=True)
    discount_percent = models.IntegerField(null=True, blank=True)
    reward_points = models.IntegerField(default=0, db_default=0)
    audience_segment = models.TextField(default='active', db_default='active')
    duration_type = models.TextField(default='indefinite', db_default='indefinite')
    status = models.TextField(default='active', db_default='active')
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    active = models.BooleanField(default=True, db_default=True)
    created_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    class Meta:
        db_table = 'campaigns'
        constraints = [
            models.CheckConstraint(condition=Q(type__in=['discount_redeem', 'points_boost']), name='campaigns_type_check'),
            models.CheckConstraint(condition=(Q(discount_percent__isnull=True) | Q(discount_percent__gte=1, discount_percent__lte=100)), name='campaigns_discount_percent_check'),
            models.CheckConstraint(condition=Q(reward_points__gte=0), name='campaigns_reward_points_check'),
            models.CheckConstraint(condition=Q(audience_segment__in=['inactive', 'at_risk', 'active', 'vip']), name='campaigns_audience_segment_check'),
            models.CheckConstraint(condition=Q(duration_type__in=['indefinite', 'one_hour', 'custom']), name='campaigns_duration_type_check'),
            models.CheckConstraint(condition=Q(status__in=['active', 'scheduled', 'ended']), name='campaigns_status_check'),
        ]
        indexes = [
            models.Index(fields=['business'], name='campaigns_business_idx'),
        ]

class CustomerMission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, db_default=RandomUUID())
    mission = models.ForeignKey('Mission', on_delete=models.CASCADE, db_column='mission_id')
    customer = models.ForeignKey('CustomerProfile', on_delete=models.CASCADE, db_column='customer_id')
    progress = models.IntegerField(default=0, db_default=0)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    class Meta:
        db_table = 'customer_missions'
        constraints = [
            models.CheckConstraint(condition=Q(progress__gte=0), name='customer_missions_progress_check'),
            models.UniqueConstraint(fields=['mission', 'customer'], name='customer_missions_natural_key'),
        ]

class StampCard(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, db_default=RandomUUID())
    business = models.ForeignKey('Business', on_delete=models.CASCADE, db_column='business_id')
    customer = models.ForeignKey('CustomerProfile', on_delete=models.CASCADE, db_column='customer_id')
    reward_name = models.TextField()
    current_stamps = models.IntegerField(default=0, db_default=0)
    required_stamps = models.IntegerField(default=10, db_default=10)
    active = models.BooleanField(default=True, db_default=True)
    updated_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    class Meta:
        db_table = 'stamp_cards'
        constraints = [
            models.CheckConstraint(condition=Q(current_stamps__gte=0), name='stamp_cards_current_stamps_check'),
            models.CheckConstraint(condition=Q(required_stamps__gt=0), name='stamp_cards_required_stamps_check'),
            models.UniqueConstraint(fields=['business', 'customer', 'reward_name'], name='stamp_cards_natural_key'),
        ]

class LoyaltyEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, db_default=RandomUUID())
    business = models.ForeignKey('Business', on_delete=models.CASCADE, db_column='business_id')
    customer = models.ForeignKey('CustomerProfile', on_delete=models.CASCADE, db_column='customer_id')
    event_type = models.TextField()
    points_delta = models.IntegerField(default=0, db_default=0)
    credit_delta_cents = models.IntegerField(default=0, db_default=0)
    metadata = models.JSONField(default=dict, db_default={})
    created_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    class Meta:
        db_table = 'loyalty_events'
        constraints = [
            models.CheckConstraint(condition=Q(event_type__in=['join', 'purchase', 'stamp', 'reward_redeem', 'mission_progress', 'mission_complete', 'credit_grant', 'credit_spend', 'minipay_payment']), name='loyalty_events_event_type_check'),
        ]
        indexes = [
            models.Index(fields=['-created_at'], name='loyalty_events_created_at_idx'),
            models.Index(fields=['business', 'customer'], name='events_business_customer_idx'),
        ]

class ClaimRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, db_default=RandomUUID())
    code = models.TextField(unique=True)
    business = models.ForeignKey('Business', on_delete=models.CASCADE, db_column='business_id')
    customer = models.ForeignKey('CustomerProfile', on_delete=models.CASCADE, db_column='customer_id')
    action_type = models.TextField()
    status = models.TextField(default='pending', db_default='pending')
    payload = models.JSONField(default=dict, db_default={})
    expires_at = models.DateTimeField()
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    class Meta:
        db_table = 'claim_requests'
        constraints = [
            models.CheckConstraint(condition=Q(action_type__in=['stamp_add', 'stamp_redeem', 'discount_redeem', 'points_boost']), name='claim_requests_action_type_check'),
            models.CheckConstraint(condition=Q(status__in=['pending', 'approved', 'rejected', 'expired']), name='claim_requests_status_check'),
        ]
        indexes = [
            models.Index(fields=['code'], name='claim_requests_code_idx'),
            models.Index(fields=['business', 'status'], name='claims_business_status_idx'),
        ]

class CampaignRedemption(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, db_default=RandomUUID())
    campaign = models.ForeignKey('Campaign', on_delete=models.CASCADE, db_column='campaign_id')
    business = models.ForeignKey('Business', on_delete=models.CASCADE, db_column='business_id')
    customer = models.ForeignKey('CustomerProfile', on_delete=models.CASCADE, db_column='customer_id')
    claim_request = models.ForeignKey('ClaimRequest', on_delete=models.SET_NULL, db_column='claim_request_id', null=True, blank=True)
    redeemed_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    class Meta:
        db_table = 'campaign_redemptions'
        indexes = [models.Index(fields=['customer'], name='redemptions_customer_idx')]
        constraints = [
            models.UniqueConstraint(fields=['campaign', 'customer'], name='campaign_redemptions_natural_key'),
        ]

class PlatformBusinessApprover(models.Model):
    user = models.OneToOneField('SupabaseAuthUser', on_delete=models.CASCADE, primary_key=True, db_column='user_id')
    class Meta:
        db_table = 'platform_business_approvers'

class CustomerIdentity(models.Model):
    auth_user = models.OneToOneField('SupabaseAuthUser', on_delete=models.CASCADE, primary_key=True, db_column='auth_user_id')
    customer = models.OneToOneField('CustomerProfile', on_delete=models.CASCADE, db_column='customer_id')
    created_at = models.DateTimeField(default=timezone.now, db_default=TransactionNow())
    class Meta:
        db_table = 'customer_identities'
