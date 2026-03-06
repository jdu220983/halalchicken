import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings.dev")

app = Celery("core")

# Read config from Django settings, the CELERY_ namespace would make it easy to override
app.config_from_object("django.conf:settings", namespace="CELERY")

# Discover tasks in installed apps
app.autodiscover_tasks()


@app.task(bind=True)
def debug_task(self):  # pragma: no cover - scaffold only
    print(f"Request: {self.request!r}")
