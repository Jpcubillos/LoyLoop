"""Authenticated bridge for the existing Supabase account-closure contract."""
import json
from django.db import connection, transaction, DatabaseError
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.response import Response
from .api import AuthenticatedView, ensure_customer
from .customer_api import strict
from .access import account_for
from .models import AppUser
from django.db.migrations.recorder import MigrationRecorder


class ProfileUnavailable(APIException):
    status_code=503
    default_detail='El servicio de perfil no esta disponible. Intentalo mas tarde.'


def account_operation(principal, delete=False):
    # Fixed identifiers only. Session-local claims are generated from the
    # independently verified Auth principal, never from client-provided IDs.
    function='delete_loyloop_account' if delete else 'check_loyloop_account_deletion'
    try:
        with transaction.atomic():
            ensure_customer(principal)
            account=account_for(principal)
            if account:
                account=AppUser.objects.select_for_update().get(pk=account.pk)
                if account.account_type=='business' and account.business_role=='owner':
                    raise PermissionDenied('Transfiere o cierra el comercio antes de eliminar esta cuenta.')
            with connection.cursor() as cursor:
                cursor.execute('SELECT to_regprocedure(%s)',['public.'+function+'()'])
                if cursor.fetchone()[0] is None:
                    raise ProfileUnavailable()
                cursor.execute("SELECT set_config('request.jwt.claim.sub',%s,true),set_config('request.jwt.claims',%s,true)",
                    [str(principal.id),json.dumps({'sub':str(principal.id),'role':'authenticated'})])
                cursor.execute('SELECT public.'+function+'()')
    except DatabaseError:
        # PostgreSQL exception details can include email or row values.
        raise PermissionDenied('No pudimos cerrar esta cuenta. Revisa si administras un comercio o contacta al soporte.') from None


class AccountDeletionCheckView(AuthenticatedView):
    def post(self,request):
        strict(request.data,[])
        account_operation(request.user)
        return Response({'ok':True})


class AccountView(AuthenticatedView):
    def delete(self,request):
        strict(request.data,[])
        account_operation(request.user,delete=True)
        return Response(status=204)


class AccountReadinessView(AuthenticatedView):
    def get(self,request):
        ready=MigrationRecorder(connection).migration_qs.filter(app='loyalty',name='0008_backend_account_closure').exists()
        return Response({'ready':ready})
