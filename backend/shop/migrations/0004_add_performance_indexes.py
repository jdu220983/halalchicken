# Generated manually for adding performance indexes

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0003_async_job"),
    ]

    operations = [
        migrations.AlterField(
            model_name="order",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
        migrations.AlterField(
            model_name="order",
            name="order_number",
            field=models.CharField(db_index=True, max_length=20, unique=True),
        ),
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("New", "New"),
                    ("Accepted", "Accepted"),
                    ("Confirmed", "Confirmed"),
                    ("OutForDelivery", "OutForDelivery"),
                    ("Delivered", "Delivered"),
                    ("Cancelled", "Cancelled"),
                ],
                db_index=True,
                default="New",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="order",
            name="user",
            field=models.ForeignKey(
                db_index=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="orders",
                to="shop.user",
            ),
        ),
        migrations.AlterField(
            model_name="product",
            name="category",
            field=models.ForeignKey(
                db_index=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="products",
                to="shop.category",
            ),
        ),
        migrations.AlterField(
            model_name="product",
            name="status",
            field=models.BooleanField(db_index=True, default=True),
        ),
        migrations.AlterField(
            model_name="product",
            name="supplier",
            field=models.ForeignKey(
                db_index=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="products",
                to="shop.supplier",
            ),
        ),
    ]
