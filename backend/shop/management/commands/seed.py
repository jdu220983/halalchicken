"""
Seed script to create initial admin users for local development.

Usage:
    python manage.py seed
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Create initial superadmin and admin users for local development"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing users before creating new ones",
        )

    def handle(self, *args, **options):
        reset = options.get("reset", False)

        if reset:
            self.stdout.write(self.style.WARNING("Deleting existing users..."))
            User.objects.all().delete()
            self.stdout.write(self.style.SUCCESS("✓ All users deleted"))

        # Create SUPERADMIN
        superadmin_username = "superadmin"
        superadmin_email = "superadmin@halalchicken.local"
        superadmin_password = "admin123"

        if User.objects.filter(username=superadmin_username).exists():
            self.stdout.write(
                self.style.WARNING(f'User "{superadmin_username}" already exists. Skipping...')
            )
        else:
            superadmin = User.objects.create_user(
                username=superadmin_username,
                email=superadmin_email,
                password=superadmin_password,
                role=User.Role.SUPERADMIN,
                fio="Super Admin",
                phone="+998901234567",
                user_type=User.UserType.INDIVIDUAL,
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ Created SUPERADMIN: {superadmin.username} ({superadmin.email})"
                )
            )
            self.stdout.write(self.style.SUCCESS(f"  Password: {superadmin_password}"))

        # Create ADMIN
        admin_username = "admin"
        admin_email = "admin@halalchicken.local"
        admin_password = "admin123"

        if User.objects.filter(username=admin_username).exists():
            self.stdout.write(
                self.style.WARNING(f'User "{admin_username}" already exists. Skipping...')
            )
        else:
            admin = User.objects.create_user(
                username=admin_username,
                email=admin_email,
                password=admin_password,
                role=User.Role.ADMIN,
                fio="Admin User",
                phone="+998901234568",
                user_type=User.UserType.INDIVIDUAL,
            )
            self.stdout.write(
                self.style.SUCCESS(f"✓ Created ADMIN: {admin.username} ({admin.email})")
            )
            self.stdout.write(self.style.SUCCESS(f"  Password: {admin_password}"))

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS("Login Credentials:"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(
            self.style.SUCCESS(f"SUPERADMIN: {superadmin_username} / {superadmin_password}")
        )
        self.stdout.write(self.style.SUCCESS(f"ADMIN: {admin_username} / {admin_password}"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("You can now login at: http://localhost:5173/login"))
