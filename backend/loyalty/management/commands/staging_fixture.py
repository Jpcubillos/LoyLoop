"""Synthetic tenant fixtures; impossible to run against remote PostgreSQL."""
import json
from uuid import UUID,uuid4
from django.core.management.base import BaseCommand,CommandError
from django.db import connection
from loyalty.models import Business,CustomerIdentity,BusinessMembership,StampCard,LoyaltyEvent


class Command(BaseCommand):
    def add_arguments(self,parser):
        parser.add_argument('--actor',required=True)
        parser.add_argument('--verify-business')

    def handle(self,*args,**options):
        if connection.settings_dict['HOST']!='/run/pgsocket' or connection.settings_dict['NAME']!='loyloop_restore':
            raise CommandError('Only the isolated restored-copy staging database is permitted.')
        actor=UUID(options['actor'])
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1 FROM auth.users WHERE id=%s AND email_confirmed_at IS NOT NULL',[actor])
            if not cursor.fetchone():
                raise CommandError('The verified test actor is absent from the restored Auth snapshot.')
        if options['verify_business']:
            business=Business.objects.get(pk=UUID(options['verify_business']),owner_user_id=actor)
            identity=CustomerIdentity.objects.get(auth_user_id=actor)
            membership=BusinessMembership.objects.get(business=business,customer=identity.customer)
            card=StampCard.objects.get(business=business,customer=identity.customer)
            if (membership.points_balance!=10 or membership.credit_balance_cents!=0 or card.current_stamps!=1
                    or LoyaltyEvent.objects.filter(business=business,event_type='stamp').count()!=1):
                raise CommandError('The persisted staging validation does not match its expected result.')
            self.stdout.write('Persisted staging membership, stamp, event and non-spent points verified.')
            return
        suffix=uuid4().hex[:12]
        own=Business.objects.create(slug='ll235-own-'+suffix,name='LL235 isolated test',category='Test',owner_user_id=actor)
        foreign=Business.objects.create(slug='ll235-foreign-'+suffix,name='LL235 foreign test',category='Test')
        self.stdout.write(json.dumps({'own':str(own.id),'slug':own.slug,'foreign':str(foreign.id)}))
