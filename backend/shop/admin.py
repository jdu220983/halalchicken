from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import (
    Cart,
    CartItem,
    Category,
    Order,
    OrderItem,
    OrderNumberSequence,
    Product,
    Supplier,
    User,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = list(DjangoUserAdmin.fieldsets or []) + [
        (
            "Profile",
            {
                "fields": (
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
            },
        ),
    ]


admin.site.register(Category)
admin.site.register(Supplier)
admin.site.register(Product)
admin.site.register(Cart)
admin.site.register(CartItem)
admin.site.register(Order)
admin.site.register(OrderItem)
admin.site.register(OrderNumberSequence)
