"""Frozen v1 adoption operations. Never infer identity or drop legacy row data.

Only migration CLI code uses these operations; business endpoints cannot invoke
them. Existing-schema adoption is explicitly gated and validated in PostgreSQL.
"""
import copy
import json
import os
import re
import uuid
from uuid import uuid4

from django.core.exceptions import ImproperlyConfigured
from django.db import migrations
from django.db.migrations.exceptions import IrreversibleError
from django.utils import timezone

TABLES = frozenset({'businesses','customer_profiles','app_users','business_leads',
    'business_memberships','rewards','missions','campaigns','customer_missions',
    'stamp_cards','loyalty_events','claim_requests','campaign_redemptions',
    'customer_identities','platform_business_approvers'})
OPTIONAL = frozenset({'customer_identities','platform_business_approvers'})
JOURNAL = 'loyloop_schema_adoptions'


def initialized_adoption(editor):
    with editor.connection.cursor() as cursor:
        cursor.execute('SELECT to_regclass(%s)', ['public.'+JOURNAL])
        if cursor.fetchone()[0] is None:
            return False
        cursor.execute('SELECT coalesce(bool_or(existed),false) FROM public.loyloop_schema_adoptions')
        return cursor.fetchone()[0]


def initialize_baseline(apps, editor):
    connection = editor.connection
    if connection.vendor != 'postgresql':
        raise ImproperlyConfigured('Business migrations require PostgreSQL.')
    existing = set(connection.introspection.table_names()) & TABLES
    isolated = (connection.settings_dict['HOST'] in {'localhost','127.0.0.1'}
                and os.environ.get('LL235_ISOLATED_DATABASE')=='yes')
    isolated_socket=(connection.settings_dict['HOST']=='/run/pgsocket'
        and connection.settings_dict['NAME']=='loyloop_restore'
        and os.environ.get('LL235_ISOLATED_DATABASE')=='yes'
        and os.environ.get('LL235_STAGING_REHEARSAL')=='yes')
    reviewed_remote=(os.environ.get('LL235_REMOTE_ADOPTION_PROJECT')=='phvuowulzkrttgcfnvly'
        and re.fullmatch('[a-f0-9]{64}',os.environ.get('LL235_VERIFIED_BACKUP_SHA256',''))
        and connection.settings_dict['HOST']=='aws-1-us-east-2.pooler.supabase.com'
        and connection.settings_dict['NAME']=='postgres'
        and connection.settings_dict['USER']=='postgres.phvuowulzkrttgcfnvly'
        and connection.settings_dict['OPTIONS'].get('sslmode')=='verify-full')
    if not (isolated or isolated_socket or reviewed_remote):
        raise ImproperlyConfigured('Use the controlled adoption command with staging and fresh verified backup evidence.')
    if existing and (os.environ.get('LL235_ADOPT_EXISTING')!='yes' or not TABLES.difference(OPTIONAL).issubset(existing)):
        raise ImproperlyConfigured('An existing complete schema requires explicit reviewed adoption.')
    with connection.cursor() as cursor:
        cursor.execute('SELECT to_regclass(%s)', ['public.'+JOURNAL])
        if cursor.fetchone()[0] is not None:
            raise ImproperlyConfigured('Unexpected existing adoption journal requires review.')
        cursor.execute('CREATE TABLE public.loyloop_schema_adoptions(table_name text PRIMARY KEY, existed boolean NOT NULL)')
        cursor.execute('ALTER TABLE public.loyloop_schema_adoptions ENABLE ROW LEVEL SECURITY')
        cursor.execute('REVOKE ALL ON public.loyloop_schema_adoptions FROM PUBLIC')
        cursor.execute('ALTER TABLE public.django_migrations ENABLE ROW LEVEL SECURITY')
        cursor.execute('REVOKE ALL ON public.django_migrations FROM PUBLIC')
        for role in ('anon','authenticated'):
            cursor.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',[role])
            if cursor.fetchone():
                cursor.execute('REVOKE ALL ON public.loyloop_schema_adoptions FROM '+editor.quote_name(role))
                cursor.execute('REVOKE ALL ON public.django_migrations FROM '+editor.quote_name(role))
        cursor.execute("SELECT pg_get_serial_sequence('public.django_migrations','id')")
        sequence=cursor.fetchone()[0]
        if sequence:
            cursor.execute('REVOKE ALL ON SEQUENCE '+sequence+' FROM PUBLIC')
            for role in ('anon','authenticated'):
                cursor.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',[role])
                if cursor.fetchone():
                    cursor.execute('REVOKE ALL ON SEQUENCE '+sequence+' FROM '+editor.quote_name(role))
        for name in sorted(TABLES):
            cursor.execute('INSERT INTO public.loyloop_schema_adoptions(table_name,existed) VALUES(%s,%s)',[name,name in existing])


def reverse_baseline(apps,editor):
    with editor.connection.cursor() as cursor:
        cursor.execute('DROP TABLE public.loyloop_schema_adoptions')


def adopted_table(editor, table):
    with editor.connection.cursor() as cursor:
        cursor.execute('SELECT existed FROM public.loyloop_schema_adoptions WHERE table_name=%s',[table])
        row = cursor.fetchone()
        return bool(row and row[0])


def canonical(value):
    if value is None:
        return None
    value = re.sub(r'\s+','',value).replace('"','').lower()
    return re.sub(r'trim\(bothfrom([a-z0-9_]+)\)',r'btrim(\1)',value)


def signature(editor, table, name):
    with editor.connection.cursor() as cursor:
        cursor.execute('''SELECT c.contype,pg_get_expr(c.conbin,c.conrelid),c.connoinherit
            FROM pg_constraint c WHERE c.conrelid=to_regclass(%s) AND c.conname=%s''',['public.'+table,name])
        row=cursor.fetchone()
        if row and row[0]=='c':
            return ('check',canonical(row[1]),row[2])
        cursor.execute('''SELECT i.indkey::text,i.indclass::text,i.indcollation::text,i.indoption::text,
            i.indisunique,i.indnullsnotdistinct,i.indisvalid,
            pg_get_expr(i.indexprs,i.indrelid),pg_get_expr(i.indpred,i.indrelid)
            FROM pg_index i JOIN pg_class x ON x.oid=i.indexrelid
            WHERE i.indrelid=to_regclass(%s) AND x.relname=%s''',['public.'+table,name])
        row=cursor.fetchone()
        return ('index',*row[:7],canonical(row[7]),canonical(row[8])) if row else None


def rename_object(editor,table,old,new):
    q=editor.quote_name
    with editor.connection.cursor() as cursor:
        cursor.execute('SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass(%s) AND conname=%s',['public.'+table,old])
        is_constraint=bool(cursor.fetchone())
    if is_constraint:
        editor.execute(f'ALTER TABLE {q(table)} RENAME CONSTRAINT {q(old)} TO {q(new)}')
    else:
        editor.execute(f'ALTER INDEX {q(old)} RENAME TO {q(new)}')


def reconcile(editor,model,item,is_index=False):
    table=model._meta.db_table
    wanted=signature(editor,table,item.name)
    probe=copy.deepcopy(item)
    probe.name='ll235_probe_'+uuid4().hex[:16]
    if is_index:
        editor.add_index(model,probe)
    else:
        editor.add_constraint(model,probe)
    desired=signature(editor,table,probe.name)
    if desired is None:
        raise ImproperlyConfigured('Unable to inspect an expected business constraint/index.')
    if wanted is not None:
        if wanted!=desired:
            raise ImproperlyConfigured('A named business constraint/index differs; manual review required.')
        if is_index: editor.remove_index(model,probe)
        else: editor.remove_constraint(model,probe)
        return
    with editor.connection.cursor() as cursor:
        names=list(editor.connection.introspection.get_constraints(cursor,table))
    equivalent=next((name for name in names if name!=probe.name and signature(editor,table,name)==desired),None)
    if equivalent:
        if is_index: editor.remove_index(model,probe)
        else: editor.remove_constraint(model,probe)
        rename_object(editor,table,equivalent,item.name)
    else:
        rename_object(editor,table,probe.name,item.name)


def validate_columns(editor,model):
    table=model._meta.db_table
    with editor.connection.cursor() as cursor:
        cursor.execute('''SELECT a.attname,format_type(a.atttypid,a.atttypmod),NOT a.attnotnull,
            pg_get_expr(d.adbin,d.adrelid)
            FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
            WHERE a.attrelid=to_regclass(%s) AND a.attnum>0 AND NOT a.attisdropped''',['public.'+table])
        actual={row[0]:row[1:] for row in cursor.fetchall()}
    fields={field.column:field for field in model._meta.local_fields}
    if set(actual)-set(fields):
        raise ImproperlyConfigured('Unexpected legacy business columns require review.')
    for name,field in fields.items():
        if name not in actual:
            if (table,name)!=('rewards','audience_segment'):
                raise ImproperlyConfigured('Missing legacy business columns require review.')
            editor.add_field(model,field)
            continue
        kind,nullable,default=actual[name]
        if kind!=field.db_type(editor.connection) or nullable!=field.null:
            raise ImproperlyConfigured('Legacy business column type/nullability differs.')
        validate_default(field,default)
    with editor.connection.cursor() as cursor:
        constraints=editor.connection.introspection.get_constraints(cursor,table)
    pk=[value['columns'] for value in constraints.values() if value.get('primary_key')]
    if pk!=[[model._meta.pk.column]]:
        raise ImproperlyConfigured('Legacy business primary key differs.')
    for field in model._meta.local_fields:
        if field.unique and not field.primary_key:
            unique=[(name,c) for name,c in constraints.items() if c.get('unique') and c['columns']==[field.column]]
            if not unique:
                raise ImproperlyConfigured('A legacy unique field lacks its required constraint.')
        if field.is_relation:
            with editor.connection.cursor() as cursor:
                cursor.execute('''SELECT n.nspname,r.relname,a.attname
                    FROM pg_constraint c JOIN pg_class r ON r.oid=c.confrelid
                    JOIN pg_namespace n ON n.oid=r.relnamespace
                    JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum=c.confkey[1]
                    WHERE c.conrelid=to_regclass(%s) AND c.contype='f'
                      AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=to_regclass(%s) AND attname=%s)]::smallint[]''',
                    ['public.'+table,'public.'+table,field.column])
                targets=cursor.fetchall()
            parts=field.remote_field.model._meta.db_table.replace('"','').split('.')
            expected=(parts[0] if len(parts)>1 else 'public',parts[-1],field.target_field.column)
            if targets!=[expected]:
                raise ImproperlyConfigured('A legacy foreign key differs from the required relationship.')
    for item in model._meta.constraints:
        reconcile(editor,model,item)
    for item in model._meta.indexes:
        reconcile(editor,model,item,is_index=True)


def validate_default(field,raw):
    if raw is None:
        if field.has_default():
            raise ImproperlyConfigured('A required legacy database default is missing.')
        return
    value=raw.strip()
    while value.startswith('(') and value.endswith(')'):
        value=value[1:-1].strip()
    value=re.sub(r'::(?:text|integer|boolean|jsonb|uuid)$','',value).strip()
    if value.lower()=='null' and not field.has_default():
        return
    expected=field.default
    if expected is uuid.uuid4:
        valid=value in {'gen_random_uuid()','extensions.gen_random_uuid()'}
    elif expected is timezone.now:
        valid=value.lower() in {'now()','current_timestamp','transaction_timestamp()'}
    elif isinstance(expected,bool):
        valid=value.lower()==str(expected).lower()
    elif isinstance(expected,int):
        valid=value==str(expected)
    elif isinstance(expected,str) or expected is dict:
        match=re.fullmatch(r"'((?:[^']|'')*)'",value)
        text=match[1].replace("''", "'") if match else None
        if expected is dict:
            try: valid=json.loads(text)=={}
            except (ValueError,TypeError): valid=False
        else:
            valid=text==expected
    else:
        valid=False
    if not valid:
        raise ImproperlyConfigured('A legacy database default differs; manual review required.')


class AdoptCreateModel(migrations.CreateModel):
    def database_forwards(self,app_label,editor,from_state,to_state):
        model=to_state.apps.get_model(app_label,self.name)
        if model._meta.managed and adopted_table(editor,model._meta.db_table):
            validate_columns(editor,model)
        else:
            super().database_forwards(app_label,editor,from_state,to_state)

    def database_backwards(self,app_label,editor,from_state,to_state):
        model=from_state.apps.get_model(app_label,self.name)
        if model._meta.managed and adopted_table(editor,model._meta.db_table):
            raise IrreversibleError('Adopted legacy data must not be dropped; use a reviewed forward fix/restore.')
        super().database_backwards(app_label,editor,from_state,to_state)


class AdoptAddConstraint(migrations.AddConstraint):
    def database_forwards(self,app_label,editor,from_state,to_state):
        model=to_state.apps.get_model(app_label,self.model_name)
        if adopted_table(editor,model._meta.db_table): reconcile(editor,model,self.constraint)
        else: super().database_forwards(app_label,editor,from_state,to_state)


class AdoptAddIndex(migrations.AddIndex):
    def database_forwards(self,app_label,editor,from_state,to_state):
        model=to_state.apps.get_model(app_label,self.model_name)
        if adopted_table(editor,model._meta.db_table): reconcile(editor,model,self.index,is_index=True)
        else: super().database_forwards(app_label,editor,from_state,to_state)


class AdoptAlterUniqueField(migrations.AlterField):
    def database_forwards(self,app_label,editor,from_state,to_state):
        model=to_state.apps.get_model(app_label,self.model_name)
        old=from_state.apps.get_model(app_label,self.model_name)._meta.get_field(self.name)
        field=model._meta.get_field(self.name)
        old_kwargs=old.deconstruct()[3];new_kwargs=field.deconstruct()[3]
        old_kwargs.pop('unique',None);new_kwargs.pop('unique',None)
        if adopted_table(editor,model._meta.db_table) and field.unique and old_kwargs==new_kwargs:
            with editor.connection.cursor() as cursor:
                constraints=editor.connection.introspection.get_constraints(cursor,model._meta.db_table)
            if any(c.get('unique') and c['columns']==[field.column] for c in constraints.values()):
                return
        super().database_forwards(app_label,editor,from_state,to_state)
