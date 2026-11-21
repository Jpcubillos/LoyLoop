"""LL domain API integration, isolated PostgreSQL ONLY; all values are fake.

Run with LL235_ISOLATED_DATABASE=yes and the loopback postgres_ci profile.
Do NOT use Supabase or production credentials to run this script.
"""
import os
from pathlib import Path
import secrets
import sys
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.postgres_ci'
os.environ.setdefault('DJANGO_SECRET_KEY', secrets.token_urlsafe(64))

import django
django.setup()
from django.core.management import call_command
from django.db import connection, connections
from rest_framework.test import APIClient as DRFClient
from config.authentication import Principal
from loyalty.models import (ActivityReceipt, AppUser, Business, BusinessMembership,
    BusinessPlanAssignment, Campaign, CampaignRedemption, ClaimRequest, CustomerIdentity,
    CustomerProfile, IdentityChallenge, LoyaltyEvent, PlatformBusinessApprover,
    Reward, StampCard, StampCompletion, RewardRedemption, BusinessAwardRule)

assert connection.settings_dict['NAME'] == 'loyloop_ll235'
assert connection.settings_dict['HOST'] == '127.0.0.1'
assert os.environ.get('LL235_ISOLATED_DATABASE') == 'yes'


class Client(DRFClient):
    def generic(self, *args, **kwargs):
        with connection.cursor() as cursor:
            cursor.execute('SET ROLE loyloop_backend')
        try:
            return super().generic(*args, **kwargs)
        finally:
            with connection.cursor() as cursor:
                cursor.execute('RESET ROLE')


def main():
    call_command('migrate', verbosity=0, interactive=False)
    call_command('makemigrations', 'loyalty', check=True, dry_run=True, verbosity=0)
    from loyalty.management.commands.provision_backend_role import grant_runtime_access
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname='loyloop_backend'")
        if cursor.fetchone() is None:
            cursor.execute('CREATE ROLE loyloop_backend NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS')
        grant_runtime_access(cursor)
        for role in ('anon','authenticated'):
            cursor.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',[role])
            if cursor.fetchone() is None:
                cursor.execute('CREATE ROLE '+role+' NOLOGIN')
        for table in ('activity_receipts','identity_challenges','stamp_completions','business_plan_assignments','reward_redemptions','business_award_rules'):
            cursor.execute('SELECT has_table_privilege(%s,%s,%s)', ['authenticated','public.'+table,'INSERT'])
            assert cursor.fetchone()[0] is False
            cursor.execute('SELECT has_table_privilege(%s,%s,%s)', ['loyloop_backend','public.'+table,'INSERT'])
            assert cursor.fetchone()[0] is True

    actors={name:Principal(uuid4(),name+'@example.invalid',name.title()) for name in ('owner','cashier','other','customer')}
    with connection.cursor() as cursor:
        for principal in actors.values():
            cursor.execute('INSERT INTO auth.users(id) VALUES(%s)',[principal.id])
    business=Business.objects.create(slug='domain-fixture',name='Fixture',category='Test',owner_user_id=actors['owner'].id)
    other=Business.objects.create(slug='domain-other',name='Other',category='Test',owner_user_id=actors['other'].id)
    for role in ('owner','cashier'):
        AppUser.objects.create(auth_user_id=actors[role].id,email=actors[role].email,
            full_name=role.title(),account_type='business',business=business,business_role=role,active=True)
    customer=CustomerProfile.objects.create(full_name='Customer',email=actors['customer'].email)
    CustomerIdentity.objects.create(auth_user_id=actors['customer'].id,customer=customer)
    AppUser.objects.create(auth_user_id=actors['customer'].id,email=actors['customer'].email,
        full_name='Customer',account_type='customer',customer=customer,active=True)
    membership=BusinessMembership.objects.create(business=business,customer=customer,points_balance=180)
    card=StampCard.objects.create(business=business,customer=customer,reward_name='Cafe gratis con 10 sellos',required_stamps=3)
    client=Client(HTTP_HOST='localhost')

    # No auth; no supplied user/tenant ID may widen a query.
    assert client.get('/api/v1/me/profile/').status_code == 401
    client.force_authenticate(actors['customer'])
    assert client.get('/api/v1/me/profile/').status_code == 200
    assert client.patch('/api/v1/me/profile/',{'email':'forged@example.invalid'},format='json').status_code == 400
    assert client.get('/api/v1/me/memberships/?customerId='+str(uuid4())).data[0]['id'] == str(membership.id)
    assert client.get('/api/v1/me/points/').status_code == 200
    assert client.get('/api/v1/me/stamps/').status_code == 200
    assert client.post(f'/api/v1/businesses/{business.id}/activities/',{},format='json').status_code == 403
    # A malformed payload must not mask missing tenant/role permissions.
    assert client.post(f'/api/v1/businesses/{business.id}/stamps/',{},format='json').status_code == 403
    assert client.post(f'/api/v1/businesses/{business.id}/identify/',{},format='json').status_code == 403
    assert client.post(f'/api/v1/businesses/{business.id}/validate-claim/',{},format='json').status_code == 403

    biz_url = f'/api/v1/businesses/{business.id}/'
    assert client.get(biz_url).status_code == 200
    assert client.get(biz_url).data['name'] == business.name
    assert client.patch(biz_url, {'name': 'Hacked'}, format='json').status_code == 403
    client.force_authenticate(actors['cashier'])
    assert client.patch(biz_url, {'name': 'Hacked'}, format='json').status_code == 403
    client.force_authenticate(actors['owner'])
    patch_res = client.patch(biz_url, {
        'name': 'Updated Business Name',
        'category': 'Restaurante',
        'address': 'Calle 100 #15-20, Bogota',
        'city': 'Bogota',
        'description': 'Programa oficial de fidelizacion'
    }, format='json')
    assert patch_res.status_code == 200, patch_res.data
    assert patch_res.data['name'] == 'Updated Business Name'
    assert patch_res.data['address'] == 'Calle 100 #15-20, Bogota'
    business.refresh_from_db()
    assert business.name == 'Updated Business Name'
    assert business.address == 'Calle 100 #15-20, Bogota'
    assert client.patch(biz_url, {'name': '   '}, format='json').status_code == 400

    activity_url=f'/api/v1/businesses/{business.id}/activities/'
    data={'membershipId':str(membership.id),'pointsAwarded':7,'stampsAdded':1,
          'stampCardId':str(card.id),'reason':'Confirmed POS purchase'}
    client.force_authenticate(actors['other'])
    assert client.post(activity_url,data,format='json',HTTP_IDEMPOTENCY_KEY='receipt-test-001').status_code == 403
    client.force_authenticate(actors['cashier'])
    assert client.post(activity_url,data,format='json').status_code == 400
    first=client.post(activity_url,data,format='json',HTTP_IDEMPOTENCY_KEY='receipt-test-001')
    assert first.status_code == 201,first.data
    replay=client.post(activity_url,data,format='json',HTTP_IDEMPOTENCY_KEY='receipt-test-001')
    assert replay.status_code == 200,replay.data
    assert replay.data['eventId'] == first.data['eventId']
    altered={**data,'pointsAwarded':999}
    assert client.post(activity_url,altered,format='json',HTTP_IDEMPOTENCY_KEY='receipt-test-001').status_code == 409
    membership.refresh_from_db();card.refresh_from_db()
    assert membership.points_balance == 187 and card.current_stamps == 1

    # Same reference from 8 independent workers must be applied exactly once.
    def duplicate(_):
        try:
            worker=Client(HTTP_HOST='localhost')
            worker.force_authenticate(actors['cashier'])
            return worker.post(activity_url,data,format='json',
                               HTTP_IDEMPOTENCY_KEY='receipt-test-002').status_code
        finally:
            connections['default'].close()
    with ThreadPoolExecutor(max_workers=8) as pool:
        statuses=list(pool.map(duplicate,range(8)))
    assert statuses.count(201)==1 and statuses.count(200)==7,statuses
    membership.refresh_from_db();card.refresh_from_db()
    assert membership.points_balance==194 and card.current_stamps==2
    assert ActivityReceipt.objects.filter(business=business).count()==2
    assert LoyaltyEvent.objects.filter(business=business,customer=customer,event_type='purchase').count()==2

    # Third stamp and a redemption: exactly one completed cycle, no points spent.
    assert client.post(activity_url,{**data,'pointsAwarded':1},format='json',
                       HTTP_IDEMPOTENCY_KEY='receipt-test-003').status_code==201
    membership.refresh_from_db();assert membership.points_balance==195
    client.force_authenticate(actors['customer'])
    claim=client.post('/api/v1/claims/',{'actionType':'stamp_redeem',
        'businessSlug':'domain-fixture','payload':{}},format='json',HTTP_IDEMPOTENCY_KEY='claim-test-001')
    assert claim.status_code==201,claim.data
    assert claim.data['manualCode'].isdigit() and len(claim.data['manualCode'])==16
    repeat=client.post('/api/v1/claims/',{'actionType':'stamp_redeem',
        'businessSlug':'domain-fixture','payload':{}},format='json',HTTP_IDEMPOTENCY_KEY='claim-test-001')
    assert repeat.status_code==200 and repeat.data['code']==claim.data['code']
    assert client.post('/api/v1/claims/',{'actionType':'stamp_add',
        'businessSlug':'domain-fixture','payload':{}},format='json',HTTP_IDEMPOTENCY_KEY='claim-test-001').status_code==409
    client.force_authenticate(actors['cashier'])
    route=f'/api/v1/businesses/{business.id}/validate-claim/'
    preview_route=f'/api/v1/businesses/{business.id}/claims/preview/'
    preview=client.post(preview_route,{'code':claim.data['manualCode']},format='json')
    assert preview.status_code==200,preview.data
    assert preview.data['customerName']=='Customer' and preview.data['canConfirm'] is True
    membership.refresh_from_db();card.refresh_from_db()
    assert membership.points_balance==195 and card.current_stamps==10
    client.force_authenticate(actors['customer'])
    assert client.post(preview_route,{'code':claim.data['manualCode']},format='json').status_code==403
    client.force_authenticate(actors['cashier'])
    assert client.post(route,{'code':claim.data['manualCode']},format='json').status_code==200
    assert client.post(route,{'code':claim.data['code']},format='json').status_code==409
    assert client.post(preview_route,{'code':claim.data['manualCode']},format='json').status_code==409
    membership.refresh_from_db();card.refresh_from_db()
    assert membership.points_balance==195 and card.current_stamps==0
    assert StampCompletion.objects.filter(card=card).count()==1

    # Capacity is rechecked while the reward row is locked; no local points spent.
    reward=Reward.objects.create(business=business,name='Free item',type='product',
                                 audience_segment='active',points_required=100,
                                 redemption_limit=1)
    client.force_authenticate(actors['customer'])
    benefit_payload={'actionType':'discount_redeem','businessSlug':'domain-fixture',
                     'payload':{'rewardId':str(reward.id)}}
    benefit=client.post('/api/v1/claims/',benefit_payload,format='json',
                        HTTP_IDEMPOTENCY_KEY='reward-test-001')
    assert benefit.status_code==201,benefit.data
    client.force_authenticate(actors['cashier'])
    assert client.post(route,{'code':benefit.data['code']},format='json').status_code==200
    assert client.post(route,{'code':benefit.data['code']},format='json').status_code==409
    assert RewardRedemption.objects.filter(reward=reward).count()==1
    membership.refresh_from_db();assert membership.points_balance==195
    client.force_authenticate(actors['customer'])
    assert client.post('/api/v1/claims/',benefit_payload,format='json',
                       HTTP_IDEMPOTENCY_KEY='reward-test-002').status_code==400
    assert client.post('/api/v1/claims/',benefit_payload,format='json',
                       HTTP_IDEMPOTENCY_KEY='reward-test-001').status_code==200

    # Two customers issue claims before a one-unit campaign is redeemed.
    # The locked campaign row ensures only one confirmation consumes capacity.
    follower=Principal(uuid4(),'follower@example.invalid','Follower')
    with connection.cursor() as cursor:
        cursor.execute('INSERT INTO auth.users(id) VALUES(%s)',[follower.id])
    follower_profile=CustomerProfile.objects.create(full_name='Follower',email=follower.email)
    CustomerIdentity.objects.create(auth_user_id=follower.id,customer=follower_profile)
    AppUser.objects.create(auth_user_id=follower.id,email=follower.email,full_name='Follower',
                           account_type='customer',customer=follower_profile,active=True)
    BusinessMembership.objects.create(business=business,customer=follower_profile)
    # Segment must be active for this explicit campaign fixture.
    LoyaltyEvent.objects.create(business=business,customer=follower_profile,event_type='purchase',points_delta=0)
    campaign=Campaign.objects.create(business=business,name='One unit',type='discount_redeem',
        audience_segment='active',discount_percent=5,redemption_limit=1)
    inputs={'actionType':'discount_redeem','businessSlug':business.slug,
            'payload':{'campaignId':str(campaign.id)}}
    client.force_authenticate(actors['customer'])
    c1=client.post('/api/v1/claims/',inputs,format='json',HTTP_IDEMPOTENCY_KEY='campaign-one-001')
    client.force_authenticate(follower)
    c2=client.post('/api/v1/claims/',inputs,format='json',HTTP_IDEMPOTENCY_KEY='campaign-two-001')
    assert c1.status_code==201 and c2.status_code==201,(c1.data,c2.data)
    def redeem_campaign(code):
        try:
            worker=Client(HTTP_HOST='localhost')
            worker.force_authenticate(actors['cashier'])
            return worker.post(route,{'code':code},format='json').status_code
        finally:
            connections['default'].close()
    with ThreadPoolExecutor(max_workers=2) as pool:
        campaign_status=list(pool.map(redeem_campaign,[c1.data['code'],c2.data['code']]))
    assert sorted(campaign_status)==[200,400],campaign_status
    assert CampaignRedemption.objects.filter(campaign=campaign).count()==1
    membership.refresh_from_db();assert membership.points_balance==195

    # Different business cannot validate an existing claim or identify customer.
    client.force_authenticate(actors['customer'])
    ticket=client.post('/api/v1/identity/issue/',{'businessId':str(business.id)},format='json')
    assert ticket.status_code==201,ticket.data
    assert ticket.data['token'] not in str(list(IdentityChallenge.objects.values('token_hash')))
    client.force_authenticate(actors['other'])
    assert client.post(f'/api/v1/businesses/{other.id}/identify/',
                       {'code':ticket.data['token']},format='json').status_code==404
    client.force_authenticate(actors['cashier'])
    verify=client.post(f'/api/v1/businesses/{business.id}/identify/',
                       {'code':ticket.data['manualCode']},format='json')
    assert verify.status_code==200,verify.data
    assert verify.data['membershipId']==str(membership.id)
    assert client.post(f'/api/v1/businesses/{business.id}/identify/',
                       {'code':ticket.data['token']},format='json').status_code==409

    # Platform-only plan assignment; no unapproved prices or billing automation.
    plan_url=f'/api/v1/businesses/{business.id}/plan/'
    assert client.put(plan_url,{'planCode':'GROWTH','status':'active'},format='json').status_code==403
    PlatformBusinessApprover.objects.create(user_id=actors['owner'].id)
    client.force_authenticate(actors['owner'])
    assert client.put(plan_url,{'planCode':'GROWTH','status':'active'},format='json').status_code==201
    assert client.get(plan_url).data['planCode']=='GROWTH'
    assert client.get('/api/v1/platform/overview/').status_code==200
    assert client.get('/api/v1/plans/').data[0]['price'] is None
    assert client.get(f'/api/v1/businesses/{other.id}/memberships/').status_code==403

    # LL-25: Discovery catalog distinguishes rewards, campaigns, missions, shows eligibility & quota.
    client.force_authenticate(actors['customer'])
    Mission.objects.create(business=business, name='Visita dos veces', category='frequency',
                           goal=2, reward_points=40, audience_segment='active')
    reward_eligible = Reward.objects.create(business=business, name='Postre de cortesía', type='product',
                                            audience_segment='active', points_required=150, redemption_limit=5)
    reward_locked = Reward.objects.create(business=business, name='Cena premium', type='product',
                                          audience_segment='active', points_required=500, redemption_limit=2)

    disc_res = client.get(f'/api/v1/discovery/{business.slug}/')
    assert disc_res.status_code == 200, disc_res.data
    disc_data = disc_res.data
    assert 'rewards' in disc_data and 'campaigns' in disc_data and 'missions' in disc_data
    assert 'stamps' in disc_data and 'membership' in disc_data and 'activity' in disc_data

    # Points balance is permanent and acts strictly as qualification threshold
    assert disc_data['membership']['points_balance'] == 195
    postre = next(r for r in disc_data['rewards'] if r['id'] == str(reward_eligible.id))
    assert postre['eligible'] is True
    assert postre['remaining_quota'] == 5
    assert 'Requiere 150 puntos' in postre['condition']

    cena = next(r for r in disc_data['rewards'] if r['id'] == str(reward_locked.id))
    assert cena['eligible'] is False
    assert cena['remaining_quota'] == 2

    # Stamps are separate from points balance
    assert disc_data['stamps']['current_stamps'] == 0
    assert disc_data['stamps']['required_stamps'] == 3
    assert disc_data['stamps']['eligible'] is False

    # Activity only reflects confirmed events, no unvalidated/phantom claims
    for ev in disc_data['activity']:
        assert ev['event_type'] in {'purchase', 'stamp', 'reward_redeem', 'mission_progress'}

    # LL-18: Configurable, versioned award rules, idempotent granting, level advancement and audited reversal
    award_url = f'/api/v1/businesses/{business.id}/award-rules/'
    client.force_authenticate(actors['customer'])
    assert client.get(award_url).status_code == 403
    assert client.put(award_url, {'pointsPerPurchase': 20, 'stampsPerPurchase': 1, 'stampsEnabled': True, 'minPurchaseCents': 0}, format='json').status_code == 403

    client.force_authenticate(actors['owner'])
    default_rules = client.get(award_url)
    assert default_rules.status_code == 200
    assert default_rules.data['pointsPerPurchase'] == 10 and default_rules.data['version'] == 1

    # Update to version 2
    update_res = client.put(award_url, {
        'pointsPerPurchase': 25,
        'stampsPerPurchase': 2,
        'stampsEnabled': True,
        'minPurchaseCents': 0
    }, format='json')
    assert update_res.status_code == 200, update_res.data
    assert update_res.data['version'] == 2
    assert update_res.data['pointsPerPurchase'] == 25

    # Awarding an activity inherits active rule version 2 and updates local tier
    client.force_authenticate(actors['cashier'])
    membership.refresh_from_db()
    prev_points = membership.points_balance  # 195
    act_data = {'membershipId': str(membership.id), 'pointsAwarded': 25, 'stampsAdded': 0, 'reason': 'Rule-based purchase'}
    act_res = client.post(activity_url, act_data, format='json', HTTP_IDEMPOTENCY_KEY='receipt-v2-001')
    assert act_res.status_code == 201, act_res.data
    assert act_res.data['ruleVersion'] == 2
    receipt_id = act_res.data['id']

    membership.refresh_from_db()
    assert membership.points_balance == prev_points + 25  # 220
    assert membership.tier == 'Frecuente'

    # Updating rule to version 3 does NOT rewrite historical receipts or points
    client.force_authenticate(actors['owner'])
    v3_res = client.put(award_url, {
        'pointsPerPurchase': 50,
        'stampsPerPurchase': 1,
        'stampsEnabled': True,
        'minPurchaseCents': 0
    }, format='json')
    assert v3_res.status_code == 200
    assert v3_res.data['version'] == 3

    # Historical receipt remains version 2 with 25 points
    old_receipt = ActivityReceipt.objects.get(pk=receipt_id)
    assert old_receipt.rule_version == 2
    assert old_receipt.points_awarded == 25
    membership.refresh_from_db()
    assert membership.points_balance == 220

    # Exceptional reversal audited, decrements points, but is NEVER presented as a points redemption
    reverse_url = f'/api/v1/businesses/{business.id}/activities/{receipt_id}/reverse/'
    client.force_authenticate(actors['customer'])
    assert client.post(reverse_url, {'reason': 'Ticket anulado por error de caja'}, format='json').status_code == 403

    client.force_authenticate(actors['owner'])
    rev_res = client.post(reverse_url, {'reason': 'Ticket anulado por error de caja'}, format='json')
    assert rev_res.status_code == 200, rev_res.data
    assert rev_res.data['ok'] is True

    # Reversal cannot be repeated
    assert client.post(reverse_url, {'reason': 'Ticket anulado por error de caja'}, format='json').status_code == 409

    # Reversal event is purchase adjustment, NOT reward_redeem
    reversal_event = LoyaltyEvent.objects.filter(business=business, metadata__reversed_receipt_id=str(receipt_id)).first()
    assert reversal_event is not None
    assert reversal_event.event_type == 'purchase'
    assert reversal_event.event_type != 'reward_redeem'
    assert reversal_event.points_delta == -25
    assert reversal_event.metadata['reversal'] is True

    # Membership points correctly decremented back to 195
    membership.refresh_from_db()
    assert membership.points_balance == 195

    # LL-117: Discovery catalog with search, category filter, pagination, inactive exclusion, and membership distinction
    inactive_biz = Business.objects.create(slug='biz-suspended', name='Negocio Suspendido', category='Cafeteria')
    BusinessPlanAssignment.objects.create(business=inactive_biz, plan_code='STARTER', status='suspended', updated_by=actors['owner'].id)

    # Anonymous discovery
    anon_client = DRFClient()
    disc_anon = anon_client.get('/api/discovery/')
    assert disc_anon.status_code == 200
    biz_slugs = [b['slug'] for b in disc_anon.data['catalog']]
    assert 'biz-suspended' not in biz_slugs
    assert business.slug in biz_slugs
    # Inactive biz directly accessed returns 404
    assert anon_client.get('/api/discovery/biz-suspended/').status_code == 404

    # Authenticated customer discovery distinguishes membership
    client.force_authenticate(actors['customer'])
    disc_auth = client.get('/api/discovery/')
    assert disc_auth.status_code == 200
    cat_item = next(b for b in disc_auth.data['catalog'] if b['slug'] == business.slug)
    assert cat_item['is_member'] is True
    assert cat_item['points_balance'] == 195
    assert cat_item['is_available'] is True

    # Search filter
    disc_search = client.get(f'/api/discovery/?q={business.name[:4]}')
    assert disc_search.status_code == 200
    assert any(b['slug'] == business.slug for b in disc_search.data['catalog'])

    # Category filter
    disc_cat = client.get(f'/api/discovery/?category={business.category}')
    assert disc_cat.status_code == 200
    assert all(b['category'] == business.category for b in disc_cat.data['catalog'])

    # Pagination
    disc_page = client.get('/api/discovery/?page=1&page_size=1')
    assert disc_page.status_code == 200
    assert len(disc_page.data['catalog']) <= 1
    assert 'pagination' in disc_page.data
    assert disc_page.data['pagination']['page'] == 1
    assert disc_page.data['pagination']['pageSize'] == 1

    # LL-120: Ficha de comercio para miembro y no miembro
    # Inactive biz cannot be joined
    assert client.post(f'/api/memberships/{inactive_biz.id}/', {}, format='json').status_code == 404

    # Member detail query
    detail_res = client.get(f'/api/discovery/{business.slug}/')
    assert detail_res.status_code == 200
    assert 'business' in detail_res.data
    assert detail_res.data['business']['is_member'] is True
    assert detail_res.data['business']['points_balance'] == 195
    assert len(detail_res.data['missions']) == 0 # MVP hides missions

    # V1 phase exposes missions
    detail_v1 = client.get(f'/api/discovery/{business.slug}/?phase=v1')
    assert detail_v1.status_code == 200
    assert len(detail_v1.data['missions']) >= 1

    # LL-123: Benefits catalog in discovery classifies rewards and campaigns with calculated eligibility
    assert 'rewards' in disc_auth.data
    assert 'campaigns' in disc_auth.data
    assert len(disc_auth.data['missions']) == 0 # MVP hides missions
    if len(disc_auth.data['rewards']) > 0:
        r_item = disc_auth.data['rewards'][0]
        assert 'condition' in r_item
        assert 'eligible' in r_item
        assert 'business_name' in r_item
    disc_benefits_v1 = client.get('/api/discovery/?phase=v1')
    assert disc_benefits_v1.status_code == 200

    # Cleanup test business
    inactive_biz.delete()

    # SQL account closure must also cascade the NEW domain ledger rows.
    # Old Django-only on_delete would have blocked the Supabase SQL function.
    with connection.cursor() as cursor:
        cursor.execute('UPDATE auth.users SET email=%s,email_confirmed_at=now() WHERE id=%s',
                       [actors['customer'].email,actors['customer'].id])
    client.force_authenticate(actors['customer'])
    assert client.delete('/api/v1/me/account/',format='json').status_code==204
    assert ActivityReceipt.objects.filter(customer_id=customer.id).count()==0
    assert RewardRedemption.objects.filter(customer_id=customer.id).count()==0
    assert IdentityChallenge.objects.filter(customer_id=customer.id).count()==0
    assert not BusinessMembership.objects.filter(customer_id=customer.id).exists()

    print('LL domain API/PG: contract, tenant/role isolation, idempotency, concurrency, cycles, QR and plans PASS.')


if __name__=='__main__':
    try:
        main()
    finally:
        # CI-only destructive teardown, guarded by the exact isolated DB above.
        call_command('migrate','loyalty','zero',verbosity=0,interactive=False)
        with connection.cursor() as cursor:
            cursor.execute('DROP OWNED BY loyloop_backend')
            cursor.execute('DROP ROLE loyloop_backend')
        connection.close()
        connection.close_pool()
