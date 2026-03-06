from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminChangeUserRoleView,
    AdminExportOrdersView,
    AdminImportProductsView,
    AdminImportTemplateView,
    AdminJobStatusView,
    AdminOrdersViewSet,
    AdminSummaryView,
    AdminUsersViewSet,
    AuthTokenObtainPairView,
    AuthTokenRefreshView,
    CartViewSet,
    CategoryViewSet,
    ChangePasswordView,
    DeleteAccountView,
    MeView,
    OrderViewSet,
    ProductViewSet,
    RegisterViewSet,
    SupplierViewSet,
    admin_telegram_contact,
    telegram_message_template,
)

router = DefaultRouter()
router.register(r"auth/register", RegisterViewSet, basename="register")
router.register(r"categories", CategoryViewSet)
router.register(r"suppliers", SupplierViewSet, basename="suppliers")
router.register(r"products", ProductViewSet)
router.register(r"cart", CartViewSet, basename="cart")
router.register(r"orders", OrderViewSet, basename="orders")
router.register(r"admin/orders", AdminOrdersViewSet, basename="admin-orders")
router.register(r"admin/users", AdminUsersViewSet, basename="admin-users")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/me/", MeView.as_view(), name="me"),
    path("auth/login/", AuthTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", AuthTokenRefreshView.as_view(), name="token_refresh"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change_password"),
    path("auth/delete-account/", DeleteAccountView.as_view(), name="delete_account"),
    path("telegram/message-template/", telegram_message_template, name="telegram_template"),
    # Admin async jobs
    path(
        "admin/orders/<int:order_id>/telegram-contact/",
        admin_telegram_contact,
        name="admin_telegram_contact",
    ),
    path("admin/export/orders/", AdminExportOrdersView.as_view(), name="admin_export_orders"),
    path("admin/import/products/", AdminImportProductsView.as_view(), name="admin_import_products"),
    path(
        "admin/import/products/template/",
        AdminImportTemplateView.as_view(),
        name="admin_import_products_template",
    ),
    path("admin/jobs/<uuid:job_id>/", AdminJobStatusView.as_view(), name="admin_job_status"),
    path("admin/summary/", AdminSummaryView.as_view(), name="admin_summary"),
    path(
        "admin/users/<int:user_id>/role/",
        AdminChangeUserRoleView.as_view(),
        name="admin_change_role",
    ),
]
