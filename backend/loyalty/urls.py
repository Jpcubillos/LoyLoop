from .v1_api import BusinessCatalogView, BusinessAwardRulesView, ReverseActivityView
from .discovery_api import DiscoveryView
from django.urls import path
from .api import SessionView, CustomerIdentityView, OffersView

from .customer_api import MembershipView, ClaimsView, ValidateClaimView, PreviewClaimView

from .admin_api import PublicLeadView, LeadsView, SegmentationView, StaffView

from .profile_api import AccountDeletionCheckView, AccountView, AccountReadinessView

urlpatterns = [
    path("discovery/",DiscoveryView.as_view()),
    path("discovery/<slug:slug>/",DiscoveryView.as_view()),
    path("account/readiness/",AccountReadinessView.as_view()),
    path("account/deletion-check/",AccountDeletionCheckView.as_view()),
    path("account/",AccountView.as_view()),
    path("business-leads/",PublicLeadView.as_view()),
    path("platform/business-leads/",LeadsView.as_view()),
    path("platform/business-leads/<uuid:lead_id>/approve/",LeadsView.as_view()),
    path("businesses/<uuid:business_id>/",BusinessCatalogView.as_view()),
    path("businesses/<uuid:business_id>/award-rules/",BusinessAwardRulesView.as_view()),
    path("businesses/<uuid:business_id>/activities/<uuid:receipt_id>/reverse/",ReverseActivityView.as_view()),
    path("businesses/<uuid:business_id>/segmentation/",SegmentationView.as_view()),
    path("businesses/<uuid:business_id>/staff/",StaffView.as_view()),
    path("businesses/<uuid:business_id>/staff/<uuid:item_id>/",StaffView.as_view()),
    path("memberships/<uuid:business_id>/",MembershipView.as_view()),
    path("claim-requests/",ClaimsView.as_view()),
    path("claim-requests/<str:code>/",ClaimsView.as_view()),
    path("businesses/<uuid:business_id>/claims/preview/",PreviewClaimView.as_view()),
    path("businesses/<uuid:business_id>/validate-claim/",ValidateClaimView.as_view()),
    path('session/',SessionView.as_view()),
    path('customer-identity/',CustomerIdentityView.as_view()),
    path('businesses/<uuid:business_id>/<str:collection>/',OffersView.as_view()),
    path('businesses/<uuid:business_id>/<str:collection>/<uuid:item_id>/',OffersView.as_view()),
]
