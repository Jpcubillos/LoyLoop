"""LL domain API: additive, tenant-scoped ledgers and manual plan state.

Migrate only through the reviewed LL-235 staging/backup procedure.
"""
import uuid
import django.contrib.postgres.functions
import django.db.models.deletion
from django.db import migrations, models
from django.db.models import Q
from django.utils import timezone

NEW_TABLES = ('activity_receipts', 'identity_challenges', 'stamp_completions',
              'business_plan_assignments', 'reward_redemptions')


def secure_domain_tables(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        raise RuntimeError('Business services require PostgreSQL.')
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname='loyloop_backend'")
        runtime_exists = cursor.fetchone() is not None
        for name in NEW_TABLES:
            table = 'public.' + schema_editor.quote_name(name)
            cursor.execute('ALTER TABLE ' + table + ' ENABLE ROW LEVEL SECURITY')
            cursor.execute('REVOKE ALL PRIVILEGES ON TABLE ' + table + ' FROM PUBLIC')
            for role in ('anon', 'authenticated'):
                cursor.execute('SELECT 1 FROM pg_roles WHERE rolname=%s', [role])
                if cursor.fetchone():
                    cursor.execute('REVOKE ALL PRIVILEGES ON TABLE ' + table + ' FROM ' + schema_editor.quote_name(role))
            if runtime_exists:
                cursor.execute('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ' + table + ' TO loyloop_backend')
                cursor.execute('CREATE POLICY loyloop_django_runtime ON ' + table +
                               ' FOR ALL TO loyloop_backend USING (true) WITH CHECK (true)')




class Migration(migrations.Migration):
    dependencies = [('loyalty', '0008_backend_account_closure')]
    operations = [
        migrations.AddField(model_name='reward', name='redemption_limit',
                            field=models.PositiveIntegerField(blank=True, null=True)),
        migrations.AddField(model_name='campaign', name='redemption_limit',
                            field=models.PositiveIntegerField(blank=True, null=True)),
        migrations.AddField(model_name='claimrequest', name='manual_code_hash',
            field=models.CharField(blank=True, max_length=64, null=True, unique=True)),
        migrations.AddField(model_name='claimrequest', name='idempotency_key',
            field=models.CharField(blank=True, max_length=120, null=True)),
        migrations.AddField(model_name='claimrequest', name='request_fingerprint',
            field=models.CharField(blank=True, max_length=64, null=True)),
        migrations.AddConstraint(model_name='claimrequest',
            constraint=models.UniqueConstraint(fields=('business','customer','idempotency_key'),
                condition=Q(idempotency_key__isnull=False), name='claims_customer_idem_uk')),
        migrations.CreateModel(name='ActivityReceipt',fields=[
            ('id',models.UUIDField(primary_key=True, serialize=False, default=uuid.uuid4,
                                   db_default=django.contrib.postgres.functions.RandomUUID())),
            ('reference',models.CharField(max_length=120)),
            ('fingerprint',models.CharField(max_length=64)),
            ('actor_id',models.UUIDField()),
            ('points_awarded',models.PositiveIntegerField(default=0)),
            ('stamps_awarded',models.PositiveIntegerField(default=0)),
            ('created_at',models.DateTimeField(default=timezone.now,
                db_default=django.contrib.postgres.functions.TransactionNow())),
            ('business',models.ForeignKey(to='loyalty.business',on_delete=django.db.models.deletion.CASCADE)),
            ('customer',models.ForeignKey(to='loyalty.customerprofile',on_delete=django.db.models.deletion.CASCADE)),
            ('event',models.OneToOneField(to='loyalty.loyaltyevent',on_delete=django.db.models.deletion.CASCADE)),
            ('card',models.ForeignKey(to='loyalty.stampcard',on_delete=django.db.models.deletion.SET_NULL,
                                    null=True,blank=True)),
        ],options={'db_table':'activity_receipts', 'constraints':[
            models.UniqueConstraint(fields=('business','reference'),name='activity_tenant_reference_uk'),
            models.CheckConstraint(condition=Q(points_awarded__gt=0)|Q(stamps_awarded__gt=0),
                                   name='activity_nonzero_grant_ck')]}),
        migrations.CreateModel(name='IdentityChallenge',fields=[
            ('id',models.UUIDField(primary_key=True, serialize=False, default=uuid.uuid4,
                                   db_default=django.contrib.postgres.functions.RandomUUID())),
            ('token_hash',models.CharField(max_length=64,unique=True)),
            ('manual_hash',models.CharField(max_length=64,unique=True)),
            ('expires_at',models.DateTimeField()),
            ('consumed_at',models.DateTimeField(null=True,blank=True)),
            ('consumed_by',models.UUIDField(null=True,blank=True)),
            ('created_at',models.DateTimeField(default=timezone.now,
                db_default=django.contrib.postgres.functions.TransactionNow())),
            ('business',models.ForeignKey(to='loyalty.business',on_delete=django.db.models.deletion.CASCADE)),
            ('customer',models.ForeignKey(to='loyalty.customerprofile',on_delete=django.db.models.deletion.CASCADE)),
        ],options={'db_table':'identity_challenges','indexes':[
            models.Index(fields=['business','expires_at'],name='identity_biz_exp_idx')]}),
        migrations.CreateModel(name='StampCompletion',fields=[
            ('id',models.UUIDField(primary_key=True, serialize=False, default=uuid.uuid4,
                                   db_default=django.contrib.postgres.functions.RandomUUID())),
            ('cycle_number',models.PositiveIntegerField()),
            ('confirmed_by',models.UUIDField()),
            ('created_at',models.DateTimeField(default=timezone.now,
                db_default=django.contrib.postgres.functions.TransactionNow())),
            ('card',models.ForeignKey(to='loyalty.stampcard',on_delete=django.db.models.deletion.CASCADE)),
            ('claim',models.OneToOneField(to='loyalty.claimrequest',on_delete=django.db.models.deletion.CASCADE)),
        ],options={'db_table':'stamp_completions','constraints':[
            models.UniqueConstraint(fields=('card','cycle_number'),name='stamp_card_cycle_uk')]}),
        migrations.CreateModel(name='BusinessPlanAssignment',fields=[
            ('business',models.OneToOneField(to='loyalty.business',primary_key=True,serialize=False,
                                            on_delete=django.db.models.deletion.CASCADE)),
            ('plan_code',models.CharField(max_length=16,
                choices=[('STARTER','STARTER'),('GROWTH','GROWTH'),('PRO','PRO')])),
            ('status',models.CharField(max_length=16,choices=[
                ('trial','trial'),('active','active'),('suspended','suspended'),('cancelled','cancelled')])),
            ('updated_by',models.UUIDField()),
            ('updated_at',models.DateTimeField(default=timezone.now,
                db_default=django.contrib.postgres.functions.TransactionNow())),
        ],options={'db_table':'business_plan_assignments'}),
        migrations.CreateModel(name='RewardRedemption',fields=[
            ('id',models.UUIDField(primary_key=True, serialize=False, default=uuid.uuid4,
                                   db_default=django.contrib.postgres.functions.RandomUUID())),
            ('confirmed_by',models.UUIDField()),
            ('created_at',models.DateTimeField(default=timezone.now,
                db_default=django.contrib.postgres.functions.TransactionNow())),
            ('reward',models.ForeignKey(to='loyalty.reward',on_delete=django.db.models.deletion.CASCADE)),
            ('claim',models.OneToOneField(to='loyalty.claimrequest',on_delete=django.db.models.deletion.CASCADE)),
            ('business',models.ForeignKey(to='loyalty.business',on_delete=django.db.models.deletion.CASCADE)),
            ('customer',models.ForeignKey(to='loyalty.customerprofile',on_delete=django.db.models.deletion.CASCADE)),
        ],options={'db_table':'reward_redemptions','indexes':[
            models.Index(fields=['reward','created_at'],name='reward_redemptions_idx')]}),
        migrations.RunPython(secure_domain_tables, migrations.RunPython.noop),
    ]
