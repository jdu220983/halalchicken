import os
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import never_cache
from rest_framework import mixins
from rest_framework import permissions as drf_permissions
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import (
    AsyncJob,
    Cart,
    CartItem,
    Category,
    Order,
    OrderItem,
    OrderNumberSequence,
    Product,
    SessionCart,
    SessionCartItem,
)
from .permissions import IsAdmin, IsAdminOrReadOnly, IsAuthenticated, IsSuperAdmin
from .serializers import (
    AdminOrderSerializer,
    CartItemSerializer,
    CartSerializer,
    CategorySerializer,
    OrderSerializer,
    ProductSerializer,
    RegisterSerializer,
    SupplierSerializer,
    UserSerializer,
)

User = get_user_model()


class RegisterViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Register a new user (individual/legal)."""

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class MeView(APIView):
    """Get or update current user's profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def put(self, request):
        return self.patch(request)


class ChangePasswordView(APIView):
    """Change password for authenticated user."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.contrib.auth.password_validation import validate_password
        from rest_framework.exceptions import ValidationError

        current_password = request.data.get("current_password")
        new_password = request.data.get("new_password")

        if not current_password or not new_password:
            return Response(
                {"detail": "Both current_password and new_password are required."}, status=400
            )

        # Verify current password
        if not request.user.check_password(current_password):
            return Response({"detail": "Current password is incorrect."}, status=400)

        # Validate new password
        try:
            validate_password(new_password, request.user)
        except ValidationError as e:
            return Response({"detail": list(e.messages)}, status=400)

        # Set new password
        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])

        return Response({"message": "Password changed successfully."})


class DeleteAccountView(APIView):
    """
    Allow authenticated users to delete their own account.
    Requires password confirmation for security.
    """

    permission_classes = [drf_permissions.IsAuthenticated]

    def post(self, request):
        password = request.data.get("password")

        if not password:
            return Response({"detail": "Password is required to delete account."}, status=400)

        # Verify password
        user = request.user
        if not user.check_password(password):
            return Response({"detail": "Invalid password."}, status=400)

        # Prevent admin/superadmin from deleting their accounts via this endpoint
        if user.role in ["ADMIN", "SUPERADMIN"]:
            return Response(
                {
                    "detail": (
                        "Admin accounts cannot be deleted through this method. "
                        "Contact a superadmin."
                    )
                },
                status=403,
            )

        # Delete the user account
        user.delete()

        return Response({"message": "Account deleted successfully."}, status=200)


class CategoryViewSet(viewsets.ModelViewSet):
    """Category CRUD (Admin write, public read)."""

    queryset = Category.objects.all().order_by("order", "id")
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["status"]
    search_fields = ["name_uz", "name_ru"]


class SupplierViewSet(viewsets.ModelViewSet):
    """Supplier CRUD (Admin write, public read)."""

    queryset = None  # type: ignore
    serializer_class = SupplierSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["status"]
    search_fields = ["name"]

    def get_queryset(self):
        from .models import Supplier

        return Supplier.objects.all().order_by("name")


class ProductViewSet(viewsets.ModelViewSet):
    """Product CRUD & list with filters/search (no prices exposed)."""

    queryset = Product.objects.select_related("category", "supplier").all().order_by("id")
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["status", "category", "supplier"]
    search_fields = ["name_uz", "name_ru", "description"]


class CartViewSet(viewsets.ViewSet):
    """Session/user cart endpoints (add/update/remove/read)."""

    permission_classes = []  # allow anonymous

    def _check_not_admin(self, user):
        """Block cart access for admin users."""
        if user.is_authenticated and user.role in ["ADMIN", "SUPERADMIN"]:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Cart functionality is not available for admin users.")

    def _session_key(self, request):
        # Try custom header first (for frontend), then fall back to Django session
        custom_session_id = request.headers.get("X-Session-ID")
        if custom_session_id:
            return custom_session_id
        if not request.session.session_key:
            request.session.create()
        return request.session.session_key

    def _get_or_create_user_cart(self, user):
        return Cart.objects.get_or_create(user=user)[0]

    def _get_or_create_session_cart(self, request):
        skey = self._session_key(request)
        cart, _ = SessionCart.objects.get_or_create(session_key=skey)
        return cart

    def _merge_session_into_user(self, request, user):
        sc = self._get_or_create_session_cart(request)
        uc = self._get_or_create_user_cart(user)
        for it in sc.items.all():
            item, created = CartItem.objects.get_or_create(
                cart=uc, product=it.product, defaults={"quantity": it.quantity}
            )
            if not created:
                item.quantity += it.quantity
                item.save(update_fields=["quantity"])
        sc.items.all().delete()
        return uc

    def list(self, request):
        self._check_not_admin(request.user)
        if request.user.is_authenticated:
            cart = self._merge_session_into_user(request, request.user)
            return Response(CartSerializer(cart).data)
        scart = self._get_or_create_session_cart(request)
        items = [
            {
                "id": it.id,
                "product": ProductSerializer(it.product).data,
                "quantity": float(it.quantity),
                "created_at": it.created_at,
            }
            for it in scart.items.select_related("product").all()
        ]
        return Response({"id": scart.id, "items": items, "created_at": scart.created_at})

    @action(detail=False, methods=["post"])
    def items(self, request):
        self._check_not_admin(request.user)
        serializer = CartItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.validated_data["product"]
        quantity = serializer.validated_data.get("quantity") or Decimal("1.00")
        if request.user.is_authenticated:
            cart = self._merge_session_into_user(request, request.user)
            item, created = CartItem.objects.get_or_create(
                cart=cart, product=product, defaults={"quantity": quantity}
            )
            if not created:
                item.quantity = quantity
                item.save(update_fields=["quantity"])
            return Response(CartSerializer(cart).data, status=status.HTTP_201_CREATED)
        scart = self._get_or_create_session_cart(request)
        sit, created = SessionCartItem.objects.get_or_create(
            cart=scart, product=product, defaults={"quantity": quantity}
        )
        if not created:
            sit.quantity = quantity
            sit.save(update_fields=["quantity"])
        return self.list(request)

    @action(detail=False, methods=["delete"], url_path="items/(?P<product_id>[^/.]+)")
    def remove(self, request, product_id: str | int):
        self._check_not_admin(request.user)
        if request.user.is_authenticated:
            cart = self._get_or_create_user_cart(request.user)
            CartItem.objects.filter(cart=cart, product_id=product_id).delete()
            return Response(CartSerializer(cart).data)
        scart = self._get_or_create_session_cart(request)
        SessionCartItem.objects.filter(cart=scart, product_id=product_id).delete()
        return self.list(request)


class OrderViewSet(GenericViewSet):
    """Create and manage orders for current user (no price data)."""

    permission_classes = [IsAuthenticated]

    def _check_customer_only(self):
        """Block order operations for admin users - admins should not place orders."""
        if self.request.user.role in ["ADMIN", "SUPERADMIN"]:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Order functionality is only available for customer users.")

    def get_throttles(self):  # apply throttle only to create action
        if getattr(self, "action", None) == "create":
            self.throttle_scope = "order_create"  # type: ignore[attr-defined]
            self.throttle_classes = [ScopedRateThrottle]  # type: ignore[attr-defined]
            return [t() for t in self.throttle_classes]
        return []

    def list(self, request):
        self._check_customer_only()
        qs = (
            Order.objects.filter(user=request.user)
            .order_by("-created_at")
            .prefetch_related("items__product")
        )
        page = self.paginate_queryset(qs)  # type: ignore[attr-defined]
        if page is not None:
            serializer = OrderSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)  # type: ignore[attr-defined]
        serializer = OrderSerializer(qs, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        self._check_customer_only()
        order = get_object_or_404(Order.objects.prefetch_related("items__product"), pk=pk)
        if order.user_id != request.user.id and getattr(request.user, "role", "") not in {
            "ADMIN",
            "SUPERADMIN",
        }:
            return Response({"detail": "Forbidden"}, status=403)
        return Response(OrderSerializer(order).data)

    def create(self, request):
        self._check_customer_only()
        cart = Cart.objects.filter(user=request.user).prefetch_related("items__product").first()
        if not cart or cart.items.count() == 0:
            return Response({"detail": "Cart is empty"}, status=400)
        with transaction.atomic():
            order_number = OrderNumberSequence.next_for_today()
            order = Order.objects.create(user=request.user, order_number=order_number)
            for item in cart.items.all():
                OrderItem.objects.create(order=order, product=item.product, quantity=item.quantity)
            cart.items.all().delete()

        # Send Telegram notification to admins (async, don't block response)
        try:
            from .telegram_service import telegram_service

            # Use Celery task if available, otherwise send synchronously
            try:
                from .tasks import send_order_notification_task

                send_order_notification_task.delay(order.id)
            except Exception:
                # Fallback to synchronous send if Celery not available
                # Reload order with relationships for notification
                order.refresh_from_db()
                order = (
                    Order.objects.select_related("user")
                    .prefetch_related("items__product")
                    .get(pk=order.id)
                )
                telegram_service.send_order_notification(order)
        except Exception as e:
            # Log error but don't fail the order creation
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send Telegram notification for order {order.id}: {e}")

        return Response(OrderSerializer(order).data, status=201)

    @action(detail=True, methods=["post"])
    def reorder(self, request, pk=None):
        """
        Clone items from an existing order into the current cart.

        - Permissions: owner only (customers only - admins cannot reorder)
        - Quantities accumulate on repeated calls (idempotence is additive)
        """
        self._check_customer_only()
        order = get_object_or_404(Order.objects.prefetch_related("items__product"), pk=pk)

        # Check ownership (only the customer who placed the order can reorder)
        if order.user_id != request.user.id:
            return Response({"detail": "Forbidden"}, status=403)

        # Customer cart only
        cart, _ = Cart.objects.get_or_create(user=request.user)
        for it in order.items.all():
            ci, created = CartItem.objects.get_or_create(
                cart=cart, product=it.product, defaults={"quantity": it.quantity}
            )
            if not created:
                ci.quantity += it.quantity
                ci.save(update_fields=["quantity"])
        return Response(CartSerializer(cart).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAdmin])
    def status(self, request, pk=None):
        order = get_object_or_404(Order, pk=pk)
        new_status = request.data.get("status")
        legal = {
            Order.Status.RECEIVED: {Order.Status.CONFIRMED},
            Order.Status.CONFIRMED: {Order.Status.SHIPPED},
            Order.Status.SHIPPED: set(),
        }
        if new_status not in dict(Order.Status.choices):
            return Response({"detail": "Invalid status"}, status=400)
        allowed = legal.get(order.status, set())
        if new_status not in allowed:
            return Response(
                {"detail": f"Illegal transition from {order.status} to {new_status}"}, status=400
            )
        order.status = new_status
        order.save(update_fields=["status", "updated_at"])
        return Response(OrderSerializer(order).data)


class AdminOrdersViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = AdminOrderSerializer
    queryset = (
        Order.objects.select_related("user")
        .prefetch_related("items__product")
        .all()
        .order_by("-created_at")
    )
    filterset_fields = {
        "status": ["exact"],
        "user": ["exact"],
        "created_at": ["date__gte", "date__lte"],
    }
    ordering = ["-created_at"]


class AdminSummaryView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        from django.utils import timezone

        today = timezone.localdate()
        from .models import Product as P
        from .models import User as U

        total_products = P.objects.filter(status=True).count()
        total_customers = U.objects.filter(role__in=["CUSTOMER"]).count()
        qs = Order.objects.all()
        todays_orders = qs.filter(created_at__date=today).count()
        new_orders = qs.filter(status=Order.Status.RECEIVED).count()
        return Response(
            {
                "today_orders": todays_orders,
                "new_orders": new_orders,
                "total_products": total_products,
                "total_customers": total_customers,
            }
        )


class AdminUsersViewSet(viewsets.ReadOnlyModelViewSet):
    """View all users (admin only)."""

    permission_classes = [IsSuperAdmin]
    serializer_class = UserSerializer
    queryset = User.objects.all().order_by("-created_at")
    filterset_fields = ["role", "user_type"]
    search_fields = ["username", "email", "fio"]


class AdminChangeUserRoleView(APIView):
    """Change user role (SUPERADMIN only)."""

    permission_classes = [IsSuperAdmin]

    def post(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        new_role = request.data.get("role")

        if new_role not in ["CUSTOMER", "ADMIN", "SUPERADMIN"]:
            return Response(
                {"detail": "Invalid role. Must be one of: CUSTOMER, ADMIN, SUPERADMIN."}, status=400
            )

        # Prevent changing your own role
        if user.id == request.user.id:
            return Response({"detail": "You cannot change your own role."}, status=400)

        # Prevent demoting the last SUPERADMIN
        if user.role == "SUPERADMIN" and new_role != "SUPERADMIN":
            superadmin_count = User.objects.filter(role="SUPERADMIN").count()
            if superadmin_count <= 1:
                return Response(
                    {
                        "detail": (
                            "Cannot demote the last SUPERADMIN. "
                            "At least one SUPERADMIN must exist."
                        )
                    },
                    status=400,
                )

        old_role = user.role
        user.role = new_role
        user.save(update_fields=["role"])

        return Response(
            {
                "id": user.id,
                "username": user.username,
                "role": user.role,
                "old_role": old_role,
                "message": f"User role changed from {old_role} to {new_role}.",
            }
        )


class AuthTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class AuthTokenRefreshView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@never_cache
def telegram_message_template(request):
    """Return a prefilled Telegram text (no prices), ready to URL-encode."""
    order_id = request.query_params.get("orderId")
    order = get_object_or_404(Order.objects.prefetch_related("items__product"), pk=order_id)
    if order.user_id != request.user.id and getattr(request.user, "role", "") not in {
        "ADMIN",
        "SUPERADMIN",
    }:
        return Response({"detail": "Forbidden"}, status=403)
    lines = [
        "Assalomu alaykum!",
        f"I placed order {order.order_number}.",
        "Could you share prices and delivery terms?",
        "",
        "Order items:",
    ]
    for it in order.items.all():
        # ABSOLUTE: never include prices
        lines.append(f"{it.product.name_uz} ({it.quantity})")
    return Response(
        {
            "text": "\n".join(lines),
            "order_number": order.order_number,
        }
    )


@api_view(["GET"])
@permission_classes([IsAdmin])
@never_cache
def admin_telegram_contact(request, order_id: int):
    """
    Return Telegram contact information for an order's customer (admin-only).

    Returns customer phone, name, a pre-filled message template, and Telegram link.
    """
    order = get_object_or_404(
        Order.objects.select_related("user").prefetch_related("items__product"), pk=order_id
    )
    customer = order.user

    # Build admin message template (no prices)
    customer_name = customer.fio or customer.username
    if customer.user_type == customer.UserType.LEGAL and customer.company_name:
        customer_name = customer.company_name

    lines = [
        f"Assalomu alaykum, {customer_name}!",
        f"Buyurtmangiz {order.order_number} bo'yicha.",
        "",
        "Buyurtma tarkibi:",
    ]
    for it in order.items.all():
        lines.append(f"• {it.product.name_uz} - {it.quantity} kg")

    lines.extend(
        [
            "",
            "Narx va yetkazib berish shartlari haqida ma'lumot bering, iltimos.",
        ]
    )

    # Build Telegram link
    # If phone exists, use phone link; otherwise use username or generic share
    telegram_link = None
    if customer.phone:
        # Clean phone: remove +, spaces, dashes
        clean_phone = customer.phone.replace("+", "").replace(" ", "").replace("-", "")
        telegram_link = f"https://t.me/{clean_phone}"
    else:
        # Fallback to share URL with pre-filled text
        text_encoded = "%0A".join(lines)
        telegram_link = f"https://t.me/share/url?url=&text={text_encoded}"

    return Response(
        {
            "customer_name": customer_name,
            "customer_phone": customer.phone or None,
            "order_number": order.order_number,
            "message_text": "\n".join(lines),
            "telegram_link": telegram_link,
        }
    )


class AdminExportOrdersView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        """
        Enqueue an async XLSX export job.

        Body params (all optional): status, user_id, date_from, date_to.
        Returns: job_id and initial status to be polled via GET /api/admin/jobs/:id
        """
        # Accept optional filters: status, user_id, date_from, date_to
        import uuid

        from .tasks import export_orders_task

        job = AsyncJob.objects.create(
            id=uuid.uuid4(),
            type=AsyncJob.Type.EXPORT_ORDERS,
            input_params={
                k: request.data.get(k)
                for k in ["status", "user_id", "date_from", "date_to"]
                if request.data.get(k) is not None
            },
        )
        export_orders_task.delay(str(job.id), job.input_params)
        return Response({"job_id": str(job.id), "status": job.status}, status=202)


class AdminImportProductsView(APIView):
    permission_classes = [IsAdmin]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "upload_import"

    def post(self, request):
        """
        Enqueue an async product import from an uploaded XLSX file.

        Multipart form with field 'file'. Returns job_id and initial status.
        Poll job status using GET /api/admin/jobs/:id.
        """
        import uuid

        from .tasks import import_products_task

        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "File is required"}, status=400)

        filename = (getattr(file, "name", "") or "").lower()
        if not filename.endswith(".xlsx"):
            return Response({"detail": "Only .xlsx files are supported"}, status=400)

        allowed_content_types = {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/octet-stream",  # some browsers send generic type
        }
        content_type = getattr(file, "content_type", "") or ""
        if content_type and content_type not in allowed_content_types:
            return Response({"detail": "Invalid content type for XLSX"}, status=400)

        max_mb = float(os.getenv("MAX_IMPORT_MB", "10"))
        if getattr(file, "size", None) and file.size > max_mb * 1024 * 1024:
            return Response({"detail": f"File too large. Max {int(max_mb)} MB"}, status=400)

        file_bytes = file.read()
        if not file_bytes:
            return Response({"detail": "Uploaded file is empty"}, status=400)

        job = AsyncJob.objects.create(
            id=uuid.uuid4(),
            type=AsyncJob.Type.IMPORT_PRODUCTS,
        )
        import_products_task.delay(str(job.id), file_bytes)
        return Response({"job_id": str(job.id), "status": job.status}, status=202)


class AdminImportTemplateView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        from openpyxl import Workbook

        wb = Workbook()
        ws = wb.active
        ws.title = "products"
        ws.append(
            ["name_uz", "name_ru", "category", "supplier", "image_url", "description", "status"]
        )
        ws.append(["Chicken breast", "Куриная грудка", "Breast", "Farm A", "", "", "true"])
        ws.append(["Chicken leg", "Куриная ножка", "Leg", "Farm B", "", "", "false"])

        from io import BytesIO

        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)

        response = HttpResponse(
            buf.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="product_import_template.xlsx"'
        return response


class AdminJobStatusView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, job_id: str):
        """
        Return the status of an async job enqueued earlier.
        """
        try:
            job = AsyncJob.objects.get(pk=job_id)
        except AsyncJob.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)
        return Response(
            {
                "id": str(job.id),
                "type": job.type,
                "status": job.status,
                "result_url": job.result_url,
                "error": job.error,
                "created_at": job.created_at,
                "finished_at": job.finished_at,
            }
        )
