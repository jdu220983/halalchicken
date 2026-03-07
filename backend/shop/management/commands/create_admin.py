from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Create an admin or superadmin user"

    def add_arguments(self, parser):
        parser.add_argument("username", type=str, help="Username for the admin")
        parser.add_argument("email", type=str, help="Email for the admin")
        parser.add_argument("password", type=str, help="Password for the admin")
        parser.add_argument(
            "--superadmin",
            action="store_true",
            help="Create as SUPERADMIN instead of ADMIN",
        )
        parser.add_argument("--fio", type=str, default="Admin User", help="Full name")
        parser.add_argument("--phone", type=str, default="", help="Phone number")

    def handle(self, *args, **options):
        username = options["username"]
        email = options["email"]
        password = options["password"]
        role = "SUPERADMIN" if options["superadmin"] else "ADMIN"
        fio = options["fio"]
        phone = options["phone"]

        # Check if user already exists
        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.ERROR(f'User with username "{username}" already exists!')
            )
            return

        # Create user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            role=role,
            fio=fio,
            phone=phone,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Successfully created {role} user: {user.username} ({user.email})"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                "  Login at: http://localhost:8000/admin/ or http://localhost:5173/login"
            )
        )
