from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        SUPERADMIN = "SUPERADMIN", "SUPERADMIN"
        ADMIN = "ADMIN", "ADMIN"
        CUSTOMER = "CUSTOMER", "CUSTOMER"

    class UserType(models.TextChoices):
        INDIVIDUAL = "INDIVIDUAL", "INDIVIDUAL"
        LEGAL = "LEGAL", "LEGAL"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CUSTOMER)
    user_type = models.CharField(
        max_length=20, choices=UserType.choices, default=UserType.INDIVIDUAL
    )

    fio = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=255, blank=True)

    # Legal entity fields
    company_name = models.CharField(max_length=255, blank=True)
    inn = models.CharField(max_length=64, blank=True)
    bank_details = models.CharField(max_length=255, blank=True)
    legal_address = models.CharField(max_length=255, blank=True)
    responsible_person = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)


class Category(models.Model):
    name_uz = models.CharField(max_length=255)
    name_ru = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name_uz


class Supplier(models.Model):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=255, blank=True)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    name_uz = models.CharField(max_length=255, blank=True, default="")
    name_ru = models.CharField(max_length=255, blank=True, default="")
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="products", db_index=True
    )
    supplier = models.ForeignKey(
        Supplier, on_delete=models.PROTECT, related_name="products", db_index=True
    )
    image_url = models.URLField(blank=True)
    description = models.TextField(blank=True)
    status = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name_uz or f"Product #{self.id}"


class Cart(models.Model):
    user = models.OneToOneField("User", on_delete=models.CASCADE, related_name="cart")
    created_at = models.DateTimeField(auto_now_add=True)


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("1.00"),
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("cart", "product")


class SessionCart(models.Model):
    session_key = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)

    def save(self, *args, **kwargs):
        if not self.expires_at:
            from datetime import timedelta

            self.expires_at = timezone.now() + timedelta(days=7)
        super().save(*args, **kwargs)


class SessionCartItem(models.Model):
    cart = models.ForeignKey(
        SessionCart, on_delete=models.CASCADE, related_name="items"
    )
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("1.00"),
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("cart", "product")


class Order(models.Model):
    class Status(models.TextChoices):
        RECEIVED = "Received", "Received"
        CONFIRMED = "Confirmed", "Confirmed"
        SHIPPED = "Shipped", "Shipped"

    user = models.ForeignKey(
        "User", on_delete=models.PROTECT, related_name="orders", db_index=True
    )
    order_number = models.CharField(max_length=20, unique=True, db_index=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.RECEIVED, db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("1.00"),
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    created_at = models.DateTimeField(auto_now_add=True)


class OrderNumberSequence(models.Model):
    date = models.DateField(unique=True)
    last_counter = models.PositiveIntegerField(default=0)

    @classmethod
    def next_for_today(cls) -> str:
        today = timezone.localdate()
        with transaction.atomic():
            seq, _ = cls.objects.select_for_update().get_or_create(date=today)
            seq.last_counter += 1
            seq.save(update_fields=["last_counter"])
            return f"#{today.strftime('%Y%m%d')}-{seq.last_counter:03d}"


class AsyncJob(models.Model):
    class Type(models.TextChoices):
        EXPORT_ORDERS = "EXPORT_ORDERS", "EXPORT_ORDERS"
        IMPORT_PRODUCTS = "IMPORT_PRODUCTS", "IMPORT_PRODUCTS"

    class Status(models.TextChoices):
        PENDING = "PENDING", "PENDING"
        RUNNING = "RUNNING", "RUNNING"
        SUCCESS = "SUCCESS", "SUCCESS"
        FAILED = "FAILED", "FAILED"

    id = models.UUIDField(primary_key=True, editable=False)
    type = models.CharField(max_length=64, choices=Type.choices)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    input_params = models.JSONField(default=dict, blank=True)
    result_url = models.URLField(blank=True)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    def mark_running(self):
        self.status = self.Status.RUNNING
        self.save(update_fields=["status"])

    def mark_success(self, url: str | None = None):
        from django.utils import timezone as _tz

        self.status = self.Status.SUCCESS
        if url:
            self.result_url = url
        self.finished_at = _tz.now()
        self.save(update_fields=["status", "result_url", "finished_at"])

    def mark_failed(self, err: str):
        from django.utils import timezone as _tz

        self.status = self.Status.FAILED
        self.error = err[:4000]
        self.finished_at = _tz.now()
        self.save(update_fields=["status", "error", "finished_at"])
