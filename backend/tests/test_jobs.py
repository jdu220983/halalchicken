import io
from unittest import mock

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_admin_export_orders_enqueues():
    client = APIClient()
    U = get_user_model()
    admin_user = U.objects.create_user(username="adminx", password="Pass123!", role="ADMIN")
    client.force_authenticate(admin_user)
    url = reverse("admin_export_orders")
    with mock.patch("shop.tasks.export_orders_task.delay", lambda *a, **k: None):
        resp = client.post(url, {"status": "Received"}, format="json")
    assert resp.status_code == 202
    assert "job_id" in resp.data


@pytest.mark.django_db
def test_admin_import_products_enqueues():
    client = APIClient()
    U = get_user_model()
    admin_user = U.objects.create_user(username="adminy", password="Pass123!", role="ADMIN")
    client.force_authenticate(admin_user)
    url = reverse("admin_import_products")
    # Build a minimal xlsx in memory with required header
    try:
        from openpyxl import Workbook
    except Exception:
        pytest.skip("openpyxl not available")
    wb = Workbook()
    ws = wb.active
    ws.append(
        [
            "name_uz",
            "name_ru",
            "category",
            "supplier",
            "image_url",
            "description",
            "status",
        ]
    )
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    upload = SimpleUploadedFile(
        "products.xlsx",
        buf.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    with mock.patch("shop.tasks.import_products_task.delay", lambda *a, **k: None):
        resp = client.post(url, {"file": upload}, format="multipart")
    assert resp.status_code == 202
    assert "job_id" in resp.data


@pytest.mark.django_db
def test_admin_import_products_rejects_non_xlsx():
    client = APIClient()
    U = get_user_model()
    admin_user = U.objects.create_user(username="adminz", password="Pass123!", role="ADMIN")
    client.force_authenticate(admin_user)
    url = reverse("admin_import_products")
    upload = SimpleUploadedFile("bad.txt", b"data", content_type="text/plain")
    resp = client.post(url, {"file": upload}, format="multipart")
    assert resp.status_code == 400
    assert "detail" in resp.json()


@pytest.mark.django_db
def test_admin_import_template_download():
    client = APIClient()
    U = get_user_model()
    admin_user = U.objects.create_user(username="admint", password="Pass123!", role="ADMIN")
    client.force_authenticate(admin_user)
    url = reverse("admin_import_products_template")
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp["Content-Type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert resp.content
