"""PostgreSQL API boundary tests. Auth transport is mocked; no real emails/tokens."""
import os
from pathlib import Path
import secrets
import sys
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ['DJANGO_SETTINGS_MODULE']='config.settings.postgres_ci'
os.environ.setdefault('DJANGO_SECRET_KEY',secrets.token_urlsafe(64))

import django
django.setup()
from django.core.management import call_command
from django.db import connection,connections
from rest_framework.test import APIClient as OwnerAPIClient
from config.authentication import Principal
from loyalty.api import ensure_customer
from loyalty.models import Business,AppUser,CustomerProfile,CustomerIdentity,BusinessMembership,Reward

import io,json,logging
log_buffer=io.StringIO()
for name in ['loyloop.http','loyloop.audit','django.request']:
    logger=logging.getLogger(name)
    handler=logging.StreamHandler(log_buffer)
    handler.setFormatter(logger.handlers[0].formatter if logger.handlers else logging.Formatter('%(message)s'))
    logger.handlers=[handler]
    logger.propagate=False


class APIClient(OwnerAPIClient):
    """Every request, including worker threads, runs with runtime SQL privileges."""
    def generic(self,*args,**kwargs):
        with connection.cursor() as cursor:cursor.execute('SET ROLE loyloop_backend')
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT current_user');assert cursor.fetchone()[0]=='loyloop_backend'
            return super().generic(*args,**kwargs)
        finally:
            with connection.cursor() as cursor:cursor.execute('RESET ROLE')

def main():
    call_command('migrate',verbosity=0,interactive=False)
    from loyalty.management.commands.provision_backend_role import grant_runtime_access
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname='loyloop_backend'")
        if not cursor.fetchone():cursor.execute('CREATE ROLE loyloop_backend NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS')
        grant_runtime_access(cursor)
    actors={name:Principal(uuid4(),name+'-'+uuid4().hex[:10]+'@example.invalid',name) for name in ['owner','manager','cashier','other','customer','legacy']}
    with connection.cursor() as cursor:
        for actor in actors.values():
            cursor.execute('INSERT INTO auth.users(id) VALUES(%s)',[actor.id])
    business=Business.objects.create(slug='api-fixture',name='Fixture',category='Fixture',owner_user_id=actors['owner'].id)
    other=Business.objects.create(slug='other-fixture',name='Other',category='Fixture',owner_user_id=actors['other'].id)
    for name in ['owner','manager','cashier']:
        AppUser.objects.create(email=actors[name].email,auth_user_id=actors[name].id,full_name=name,
                               account_type='business',business=business,business_role=name,active=True)
    client=APIClient(HTTP_HOST='localhost')
    assert client.get('/api/session/').status_code==401
    base=f'/api/businesses/{business.id}/rewards/'
    client.force_authenticate(actors['manager'])
    response=client.post(base,{'name':'Fixture reward','type':'product'},format='json')
    assert response.status_code==201,response.data
    reward_id=response.data['id']
    assert client.patch(base+reward_id+'/',{'business_id':str(other.id)},format='json').status_code==400
    assert client.patch(base+reward_id+'/',{'name':'Updated'},format='json').status_code==200
    assert Reward.objects.get(pk=reward_id).business_id==business.id
    assert client.patch(base,{},format='json').status_code==405
    assert client.post(f'/api/businesses/{business.id}/missions/',{'name':'Bad','category':'frequency','goal':0},format='json').status_code==400
    client.force_authenticate(actors['cashier'])
    assert client.post(base,{'name':'Forbidden','type':'product'},format='json').status_code==403
    client.force_authenticate(actors['other'])
    assert client.delete(base+reward_id+'/').status_code==403
    foreign_reward=Reward.objects.create(business=other,name='Other',type='product')
    client.force_authenticate(actors['manager'])
    assert client.delete(base+str(foreign_reward.id)+'/').status_code==404
    account=AppUser.objects.get(auth_user_id=actors['manager'].id)
    account.active=False;account.save(update_fields=['active'])
    assert client.get('/api/session/').status_code==403
    account.active=True;account.save(update_fields=['active'])

    # An unbound legacy team record cannot grant itself privileges by verified email.
    AppUser.objects.create(email=actors['legacy'].email,full_name='Legacy',account_type='business',business=business,business_role='owner')
    client.force_authenticate(actors['legacy'])
    assert client.post(base,{'name':'Forbidden','type':'product'},format='json').status_code==403

    # A reviewed data migration can bind a confirmed Auth record; the client cannot.
    from importlib import import_module
    from django.db import transaction
    with connection.cursor() as cursor:
        cursor.execute('UPDATE auth.users SET email=%s,email_confirmed_at=now() WHERE id=%s',[actors['legacy'].email,actors['legacy'].id])
    with transaction.atomic(),connection.schema_editor() as editor:
        import_module('loyalty.migrations.0005_bind_verified_auth_accounts').bind_verified_accounts(None,editor)
    assert AppUser.objects.get(email=actors['legacy'].email).auth_user_id==actors['legacy'].id
    assert client.get('/api/session/').data['business_role']=='owner'

    # Explicit customer bootstrap preserves the existing profile and its balances.
    profile=CustomerProfile.objects.create(email=actors['customer'].email.upper(),full_name='Legacy customer')
    membership=BusinessMembership.objects.create(business=business,customer=profile,points_balance=180)
    AppUser.objects.create(email=actors['customer'].email.upper(),full_name='Legacy',account_type='customer',customer=profile)
    client.force_authenticate(actors['customer'])
    assert client.post('/api/customer-identity/',{'customer_id':str(profile.id)},format='json').status_code==400
    assert client.post('/api/customer-identity/',{},format='json').status_code==200

    def bootstrap(_):
        try:
            return ensure_customer(actors['customer']).id
        finally:
            connections['default'].close()
    with ThreadPoolExecutor(max_workers=6) as executor:
        assert set(executor.map(bootstrap,range(12)))=={profile.id}
    assert CustomerIdentity.objects.filter(auth_user_id=actors['customer'].id).count()==1
    assert AppUser.objects.filter(auth_user_id=actors['customer'].id).count()==1
    membership.refresh_from_db();assert membership.points_balance==180
    client.force_authenticate(actors['owner'])
    assert client.delete(base+reward_id+'/').status_code==204

    # Enabling routes before the permission migration must still fail closed.
    from django.db.migrations.recorder import MigrationRecorder
    MigrationRecorder.Migration.objects.filter(app='loyalty',name='0002_client_write_boundary').delete()
    assert client.get('/api/session/').status_code==503
    MigrationRecorder(connection).record_applied('loyalty','0002_client_write_boundary')

    # Server-owned claims: membership, tenant isolation and concurrent replay.
    from loyalty.models import ClaimRequest,StampCard,LoyaltyEvent,Campaign,CampaignRedemption
    from django.utils import timezone
    from datetime import timedelta
    client.force_authenticate(actors['customer'])
    join=f'/api/memberships/{other.id}/'
    assert client.post(join,{'points_balance':999},format='json').status_code==400
    assert client.post(join,{},format='json').status_code==201
    assert client.post(join,{},format='json').status_code==200
    assert BusinessMembership.objects.get(customer=profile,business=other).points_balance==0
    assert LoyaltyEvent.objects.filter(customer=profile,business=other,event_type='join').count()==1
    response=client.post('/api/claim-requests/',{'actionType':'stamp_add','businessSlug':business.slug,'payload':{'rewardPoints':999}},format='json')
    assert response.status_code==201,response.data
    code=response.data['code']
    assert len(code)==24
    assert ClaimRequest.objects.get(code=code).payload=={}
    client.force_authenticate(actors['other'])
    assert client.get(f'/api/claim-requests/{code}/').status_code==404
    assert client.post(f'/api/businesses/{other.id}/validate-claim/',{'code':code},format='json').status_code==404

    def validate_once(_):
        try:
            c=APIClient(HTTP_HOST='localhost'); c.force_authenticate(actors['cashier'])
            return c.post(f'/api/businesses/{business.id}/validate-claim/',{'code':code},format='json').status_code
        finally:
            connections['default'].close()
    with ThreadPoolExecutor(max_workers=4) as executor:
        results=list(executor.map(validate_once,range(8)))
    assert results.count(200)==1 and results.count(409)==7,results
    membership.refresh_from_db(); assert membership.points_balance==190
    assert StampCard.objects.get(customer=profile,business=business).current_stamps==1
    assert LoyaltyEvent.objects.filter(customer=profile,business=business,event_type='stamp').count()==1
    client.force_authenticate(actors['customer'])
    assert client.get(f'/api/claim-requests/{code}/').data['status']=='approved'
    # The merchant must recheck campaign availability, never trust points from a payload.
    campaign=Campaign.objects.create(business=business,name='Fixture boost',type='points_boost',audience_segment='active',reward_points=25)
    response=client.post('/api/claim-requests/',{'actionType':'points_boost','businessSlug':business.slug,'payload':{'campaignId':str(campaign.id),'rewardPoints':100000}},format='json')
    assert response.status_code==201,response.data
    boost=response.data['code']
    client.force_authenticate(actors['cashier'])
    assert client.post(f'/api/businesses/{business.id}/validate-claim/',{'code':boost},format='json').status_code==200
    membership.refresh_from_db();assert membership.points_balance==215
    assert CampaignRedemption.objects.filter(customer=profile,campaign=campaign).count()==1
    client.force_authenticate(actors['customer'])
    assert client.post('/api/claim-requests/',{'actionType':'points_boost','businessSlug':business.slug,'payload':{'campaignId':str(campaign.id)}},format='json').status_code==400
    expired=ClaimRequest.objects.create(business=business,customer=profile,code='EXPIRED',action_type='stamp_add',expires_at=timezone.now()-timedelta(seconds=1))
    client.force_authenticate(actors['cashier'])
    assert client.post(f'/api/businesses/{business.id}/validate-claim/',{'code':expired.code},format='json').status_code==409
    expired.refresh_from_db();assert expired.status=='expired'
    print('Claims/PG: zero-balance idempotent join, tenant isolation, expiration, concurrent exactly-once validation and server-owned campaign points passed.')

    # Discount benefits validate level eligibility and never spend loyalty points.
    client.force_authenticate(actors['customer'])
    discount=Reward.objects.create(business=business,name='Level discount',type='discount',audience_segment='active',points_required=200)
    response=client.post('/api/claim-requests/',{'actionType':'discount_redeem','businessSlug':business.slug,'payload':{'rewardId':str(discount.id)}},format='json')
    assert response.status_code==201,response.data
    benefit_code=response.data['code']
    client.force_authenticate(actors['cashier'])
    assert client.post(f'/api/businesses/{business.id}/validate-claim/',{'code':benefit_code},format='json').status_code==200
    membership.refresh_from_db();assert membership.points_balance==215
    client.force_authenticate(actors['customer'])
    discount.points_required=500;discount.save(update_fields=['points_required'])
    assert client.post('/api/claim-requests/',{'actionType':'discount_redeem','businessSlug':business.slug,'payload':{'rewardId':str(discount.id)}},format='json').status_code==400

    # Platform approval is independent from merchant ownership.
    from loyalty.models import BusinessLead,PlatformBusinessApprover
    client.force_authenticate(actors['owner'])
    assert client.get('/api/platform/business-leads/').status_code==403
    lead=BusinessLead.objects.create(owner_name='Fixture',business_name='New fixture',email='unregistered@example.invalid')
    PlatformBusinessApprover.objects.create(user_id=actors['owner'].id)
    response=client.post(f'/api/platform/business-leads/{lead.id}/approve/',{},format='json')
    assert response.status_code==201,response.data
    published=response.data['business_id']
    assert client.post(f'/api/platform/business-leads/{lead.id}/approve/',{},format='json').data['business_id']==published
    assert Business.objects.get(pk=published).owner_user_id is None
    client.force_authenticate(actors['manager'])
    assert client.patch(f'/api/businesses/{business.id}/segmentation/',{'vip_purchase_threshold':5,'at_risk_days':30,'inactive_days':60},format='json').status_code==403
    client.force_authenticate(actors['owner'])
    assert client.patch(f'/api/businesses/{business.id}/segmentation/',{'vip_purchase_threshold':5,'at_risk_days':30,'inactive_days':20},format='json').status_code==400
    assert client.patch(f'/api/businesses/{business.id}/segmentation/',{'vip_purchase_threshold':5,'at_risk_days':30,'inactive_days':60},format='json').status_code==200
    staff=AppUser.objects.get(auth_user_id=actors['cashier'].id)
    assert client.patch(f'/api/businesses/{business.id}/staff/{staff.id}/',{'business_id':str(other.id)},format='json').status_code==400
    assert client.patch(f'/api/businesses/{business.id}/staff/{staff.id}/',{'active':False},format='json').status_code==200
    owner_record=AppUser.objects.get(auth_user_id=actors['owner'].id)
    assert client.patch(f'/api/businesses/{business.id}/staff/{owner_record.id}/',{'active':False},format='json').status_code==400
    client.force_authenticate(actors['other'])
    assert client.get(f'/api/businesses/{business.id}/staff/').status_code==403
    print('Admin/PG: platform-only idempotent approval, owner-only settings, staff tenant isolation and ownership preservation passed.')

    # Account closure uses verified server claims and the existing SQL contract.
    with connection.cursor() as cursor:
        cursor.execute("CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$")
    closer=Principal(uuid4(),'closure-'+uuid4().hex+'@example.invalid','Closure fixture')
    with connection.cursor() as cursor:
        cursor.execute('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(%s,%s,now())',[closer.id,closer.email])
    client.force_authenticate(closer)
    assert client.post('/api/customer-identity/',{},format='json').status_code==200
    assert client.delete('/api/account/',{'id':str(actors['owner'].id)},format='json').status_code==400
    assert client.post('/api/account/deletion-check/',{},format='json').status_code==200
    assert client.delete('/api/account/',format='json').status_code==204
    assert not AppUser.objects.filter(auth_user_id=closer.id).exists()
    with connection.cursor() as cursor:
        cursor.execute('SELECT count(*) FROM auth.users WHERE id=%s',[closer.id]);assert cursor.fetchone()[0]==0
        cursor.execute('SELECT count(*) FROM auth.users WHERE id=%s',[actors['owner'].id]);assert cursor.fetchone()[0]==1
        cursor.execute("SELECT nullif(current_setting('request.jwt.claim.sub',true),'')");assert cursor.fetchone()[0] is None
    client.force_authenticate(actors['owner'])
    assert client.delete('/api/account/',format='json').status_code==403
    # Legacy owners remain protected even if owner_user_id predates provisioning.
    business.owner_user_id=None;business.save(update_fields=['owner_user'])
    assert client.post('/api/account/deletion-check/',{},format='json').status_code==403
    assert client.delete('/api/account/',format='json').status_code==403
    business.owner_user_id=actors['owner'].id;business.save(update_fields=['owner_user'])
    print('Profile/PG: own-account closure, rejected client identity, owner protection and transaction-local claims passed (isolated SQL fixture).')

    events=[json.loads(line) for line in log_buffer.getvalue().splitlines()]
    spans={event['trace_id'] for event in events if event['event']=='http_span'}
    actions=[event for event in events if event['event']=='business_action']
    assert actions and all(event.get('trace_id') in spans and event['actor_id'] and event['tenant_id'] for event in actions)
    assert code not in log_buffer.getvalue() and actors['customer'].email not in log_buffer.getvalue()
    print('Telemetry/PG: committed actions carry actor, tenant and matching request trace; claim codes and email absent.')



if __name__=='__main__':
    try:
        main()
    finally:
        call_command('migrate','loyalty','zero',verbosity=0,interactive=False)
        with connection.cursor() as cursor:
            cursor.execute('DROP OWNED BY loyloop_backend');cursor.execute('DROP ROLE loyloop_backend')
        connection.close();connection.close_pool()
    print('API/PG: all permission, claim, identity, profile and telemetry assertions passed (Auth transport mocked).')
