"""Versioned domain contracts. /api/legacy routes remain in loyalty.urls."""
from django.urls import path
from .v1_api import (MyProfileView, BusinessCatalogView, MyMembershipsView,
    MerchantMembershipsView, MyPointsView, MerchantPointsView,
    MyStampCardsView, MerchantStampCardsView, IdentityIssueView,
    IdentityVerifyView, PlanCatalogView, BusinessPlanView, PlatformOverviewView)
from .api import SessionView, CustomerIdentityView, OffersView
from .customer_api import MembershipView, V1ClaimsView, ValidateClaimView
from .admin_api import PublicLeadView, LeadsView, SegmentationView, StaffView
from .profile_api import AccountDeletionCheckView, AccountView
from .discovery_api import DiscoveryView

urlpatterns=[
    path('session/',SessionView.as_view()),
    path('me/profile/',MyProfileView.as_view()),
    path('me/memberships/',MyMembershipsView.as_view()),
    path('me/points/',MyPointsView.as_view()),
    path('me/stamps/',MyStampCardsView.as_view()),
    path('me/identity/',CustomerIdentityView.as_view()),
    path('me/account/',AccountView.as_view()),
    path('me/account/deletion-check/',AccountDeletionCheckView.as_view()),
    path('businesses/',BusinessCatalogView.as_view()),
    path('businesses/<uuid:business_id>/',BusinessCatalogView.as_view()),
    path('businesses/<uuid:business_id>/memberships/',MerchantMembershipsView.as_view()),
    path('businesses/<uuid:business_id>/activities/',MerchantPointsView.as_view()),
    path('businesses/<uuid:business_id>/stamps/',MerchantStampCardsView.as_view()),
    path('businesses/<uuid:business_id>/identify/',IdentityVerifyView.as_view()),
    path('businesses/<uuid:business_id>/validate-claim/',ValidateClaimView.as_view()),
    path('businesses/<uuid:business_id>/plan/',BusinessPlanView.as_view()),
    path('businesses/<uuid:business_id>/segmentation/',SegmentationView.as_view()),
    path('businesses/<uuid:business_id>/staff/',StaffView.as_view()),
    path('businesses/<uuid:business_id>/staff/<uuid:item_id>/',StaffView.as_view()),
    path('businesses/<uuid:business_id>/<str:collection>/',OffersView.as_view()),
    path('businesses/<uuid:business_id>/<str:collection>/<uuid:item_id>/',OffersView.as_view()),
    path('memberships/<uuid:business_id>/',MembershipView.as_view()),
    path('claims/',V1ClaimsView.as_view()),
    path('claims/<str:code>/',V1ClaimsView.as_view()),
    path('identity/issue/',IdentityIssueView.as_view()),
    path('plans/',PlanCatalogView.as_view()),
    path('discovery/',DiscoveryView.as_view()),
    path('discovery/<slug:slug>/',DiscoveryView.as_view()),
    path('business-leads/',PublicLeadView.as_view()),
    path('platform/business-leads/',LeadsView.as_view()),
    path('platform/business-leads/<uuid:lead_id>/approve/',LeadsView.as_view()),
    path('platform/overview/',PlatformOverviewView.as_view()),
]
