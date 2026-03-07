from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from shop.models import Category, Product, Supplier


class Command(BaseCommand):
    help = "Seed demo categories, suppliers, and products (idempotent)"

    def handle(self, *args, **options):
        User = get_user_model()
        # Ensure an admin user exists for E2E/CI
        admin, created = User.objects.get_or_create(
            username="admin", defaults={"role": "ADMIN"}
        )
        if created:
            admin.set_password("admin")
            admin.save(update_fields=["password"])
        cats = [
            ("Whole chicken", "Целая курица"),
            ("Breast", "Грудка"),
            ("Leg", "Бедро"),
        ]
        sups = [
            ("Farm A", ""),
            ("Farm B", ""),
        ]
        created_cats = []
        for uz, ru in cats:
            c, _ = Category.objects.get_or_create(name_uz=uz, defaults={"name_ru": ru})
            created_cats.append(c)
        created_sups = []
        for name, phone in sups:
            s, _ = Supplier.objects.get_or_create(name=name, defaults={"phone": phone})
            created_sups.append(s)
        # products
        defaults = [
            ("Chicken breast", "Куриная грудка", 1),
            ("Chicken leg", "Куриная ножка", 2),
        ]
        for idx, (uz, ru, cat_idx) in enumerate(defaults):
            cat = created_cats[min(cat_idx, len(created_cats)) - 1]
            sup = created_sups[0]
            Product.objects.get_or_create(
                name_uz=uz,
                defaults={
                    "name_ru": ru,
                    "category": cat,
                    "supplier": sup,
                    "image_url": "",
                    "description": "",
                    "status": True,
                },
            )
        self.stdout.write(self.style.SUCCESS("Demo data seeded (idempotent)"))
