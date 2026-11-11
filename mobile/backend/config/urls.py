from django.urls import path
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@never_cache
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    """Liveness only: this endpoint does not verify any external service."""
    return Response({"status": "ok"})


urlpatterns = [path("health/", health, name="health")]
