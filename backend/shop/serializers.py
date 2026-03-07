import os
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Cart, CartItem, Category, Order, OrderItem, Product, Supplier
from .storage import get_storage

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(allow_blank=True, required=False, max_length=254)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32)
    inn = serializers.CharField(required=False, allow_blank=True, max_length=64)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "password",
            "role",
            "user_type",
            "fio",
            "phone",
            "address",
            "company_name",
            "inn",
            "bank_details",
            "legal_address",
            "responsible_person",
        )
        read_only_fields = ("id", "role")

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data["role"] = User.Role.CUSTOMER
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def validate(self, attrs):
        user_type = attrs.get("user_type") or User.UserType.INDIVIDUAL
        required_for_all = ["phone"]
        missing = [field for field in required_for_all if not attrs.get(field)]

        if user_type == User.UserType.INDIVIDUAL:
            required_individual = ["fio", "address"]
            missing += [field for field in required_individual if not attrs.get(field)]
        else:
            required_legal = [
                "company_name",
                "responsible_person",
                "address",
                "legal_address",
                "inn",
                "bank_details",
                "email",
            ]
            missing += [field for field in required_legal if not attrs.get(field)]

        if missing:
            raise serializers.ValidationError(
                {f: "This field is required." for f in missing}
            )
        return attrs

    def validate_inn(self, value: str) -> str:
        import re

        if not value:
            return value
        if not re.fullmatch(r"^[0-9A-Za-z-]{6,64}$", value):
            raise serializers.ValidationError("Invalid INN format")
        return value


class UserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(allow_blank=True, required=False, max_length=254)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=32)
    inn = serializers.CharField(required=False, allow_blank=True, max_length=64)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "role",
            "user_type",
            "fio",
            "phone",
            "address",
            "company_name",
            "inn",
            "bank_details",
            "legal_address",
            "responsible_person",
        )
        read_only_fields = ("id", "role")


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name_uz", "name_ru", "order", "status", "created_at")


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ("id", "name", "phone", "address", "status", "created_at")


class ProductSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), write_only=True, source="category"
    )
    supplier = SupplierSerializer(read_only=True)
    supplier_id = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(), write_only=True, source="supplier"
    )
    image_file = serializers.FileField(write_only=True, required=False, allow_null=True)
    name_uz = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )
    name_ru = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )

    class Meta:
        model = Product
        fields = (
            "id",
            "name_uz",
            "name_ru",
            "category",
            "category_id",
            "supplier",
            "supplier_id",
            "image_url",
            "image_file",
            "description",
            "status",
            "created_at",
        )

    def validate_image_file(self, f):
        if not f:
            return f
        # Validate magic bytes, not HTTP header
        from PIL import Image, UnidentifiedImageError

        f.seek(0)
        try:
            with Image.open(f) as img:
                image_type = (img.format or "").lower()
        except UnidentifiedImageError:
            image_type = None
        f.seek(0)
        if image_type not in {"jpeg", "png", "webp"}:
            raise serializers.ValidationError(
                "Unsupported image type. Allowed: jpg, png, webp"
            )
        # size check
        max_mb = float(os.getenv("MAX_IMAGE_MB", "5"))
        if f.size and f.size > max_mb * 1024 * 1024:
            raise serializers.ValidationError(f"Image too large. Max {int(max_mb)} MB")
        return f

    def _maybe_upload(self, validated_data):
        f = validated_data.pop("image_file", None)
        if f:
            storage = get_storage()
            url = storage.save_bytes(f.read(), f.name, getattr(f, "content_type", None))
            validated_data["image_url"] = url
        return validated_data

    def create(self, validated_data):
        v = self._maybe_upload(validated_data)
        return super().create(v)

    def update(self, instance, validated_data):
        v = self._maybe_upload(validated_data)
        return super().update(instance, v)


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), write_only=True, source="product"
    )
    quantity = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
        required=False,
        default=Decimal("1.00"),
        coerce_to_string=False,
    )

    class Meta:
        model = CartItem
        fields = ("id", "product", "product_id", "quantity", "created_at")


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = ("id", "items", "created_at")


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    quantity = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
        read_only=True,
        coerce_to_string=False,
    )

    class Meta:
        model = OrderItem
        fields = ("id", "product", "quantity", "created_at")


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ("id", "order_number", "status", "created_at", "updated_at", "items")


class AdminOrderSerializer(serializers.ModelSerializer):
    """Order serializer for admin views, includes user contact information."""

    items = OrderItemSerializer(many=True, read_only=True)
    user = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "status",
            "created_at",
            "updated_at",
            "items",
            "user",
        )

    def get_user(self, obj):
        """Return user contact info for admin views."""
        user = obj.user
        return {
            "id": user.id,
            "username": user.username,
            "fio": user.fio or user.username,
            "phone": user.phone,
            "email": user.email,
            "user_type": user.user_type,
            "company_name": (
                user.company_name if user.user_type == User.UserType.LEGAL else None
            ),
        }
