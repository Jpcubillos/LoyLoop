from django.conf import settings
from django.urls import path, include
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .readiness import ready
from .telemetry import metrics, alerts


@never_cache
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    """Liveness only: this endpoint does not verify any external service."""
    return Response({"status": "ok"})


urlpatterns = [path("internal/alerts/",alerts), path("internal/metrics/",metrics), path("health/", health, name="health"), path("ready/", ready, name="ready")]
if 'loyalty' in settings.INSTALLED_APPS and settings.BUSINESS_API_ENABLED:
    urlpatterns += [path('api/', include('loyalty.urls'))]
