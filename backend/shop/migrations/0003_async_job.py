import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0002_session_cart"),
    ]

    operations = [
        migrations.CreateModel(
            name="AsyncJob",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        primary_key=True, default=uuid.uuid4, editable=False, serialize=False
                    ),
                ),
                (
                    "type",
                    models.CharField(
                        choices=[
                            ("EXPORT_ORDERS", "EXPORT_ORDERS"),
                            ("IMPORT_PRODUCTS", "IMPORT_PRODUCTS"),
                        ],
                        max_length=64,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("PENDING", "PENDING"),
                            ("RUNNING", "RUNNING"),
                            ("SUCCESS", "SUCCESS"),
                            ("FAILED", "FAILED"),
                        ],
                        default="PENDING",
                        max_length=16,
                    ),
                ),
                ("input_params", models.JSONField(blank=True, default=dict)),
                ("result_url", models.URLField(blank=True)),
                ("error", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
            ],
        ),
    ]
