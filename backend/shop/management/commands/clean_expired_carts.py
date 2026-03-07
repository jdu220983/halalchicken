from django.core.management.base import BaseCommand
from django.utils import timezone
from shop.models import SessionCart


class Command(BaseCommand):
    help = "Delete expired session carts"

    def handle(self, *args, **options):
        cutoff = timezone.now()
        deleted_count, _ = SessionCart.objects.filter(expires_at__lt=cutoff).delete()
        self.stdout.write(
            self.style.SUCCESS(f"Deleted {deleted_count} expired session carts")
        )
