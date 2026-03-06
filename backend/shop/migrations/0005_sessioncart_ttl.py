# Generated manually for adding SessionCart TTL

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shop", "0004_add_performance_indexes"),
    ]

    operations = [
        migrations.AlterField(
            model_name="sessioncart",
            name="created_at",
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
        migrations.AddField(
            model_name="sessioncart",
            name="expires_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
    ]
