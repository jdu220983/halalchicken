from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0010_alter_order_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="is_in_stock",
            field=models.BooleanField(default=True, db_index=True),
        ),
    ]