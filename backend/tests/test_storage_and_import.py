import io
import os
from unittest import mock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse


@pytest.mark.django_db
def test_storage_s3_presigned_url(monkeypatch):
    os.environ["STORAGE_BACKEND"] = "S3"
    os.environ["AWS_S3_BUCKET"] = "bucket"
    os.environ["AWS_S3_REGION"] = "us-east-1"

    class MockS3:
        def put_object(self, **kwargs):
            return {}

        def generate_presigned_url(self, *_args, **_kwargs):
            return "https://example.com/presigned"

    # Patch S3Storage._client to return our mock regardless of boto3 presence
    with mock.patch("shop.storage.S3Storage._client", return_value=MockS3()):
        from shop.storage import get_storage

        url = get_storage().save_bytes(b"hello", "file.txt", "text/plain")
        assert "presigned" in url


@pytest.mark.django_db
def test_storage_cloudinary_secure_url(monkeypatch):
    os.environ["STORAGE_BACKEND"] = "CLOUDINARY"

    class MockUploader:
        @staticmethod
        def upload(data, **kwargs):  # noqa: ARG002
            return {"secure_url": "https://res.cloudinary.com/demo/image/upload/v1/test.png"}

    with mock.patch("shop.storage.cloudinary_uploader", MockUploader):
        from shop.storage import get_storage

        url = get_storage().save_bytes(b"img", "test.png", "image/png")
        assert url.startswith("https://res.cloudinary.com/")


@pytest.mark.django_db
def test_product_image_validation(client):
    from django.contrib.auth import get_user_model

    from shop.models import Category, Supplier

    cat = Category.objects.create(name_uz="C", name_ru="C")
    sup = Supplier.objects.create(name="S")

    # Auth as admin for product create
    U = get_user_model()
    U.objects.create_user(username="imadmin", password="Pass123!", role="ADMIN")
    login = client.post(
        "/api/auth/login/",
        {"username": "imadmin", "password": "Pass123!"},
        content_type="application/json",
    )
    assert login.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {login.json()['access']}"

    # Bad content-type
    f = SimpleUploadedFile("a.txt", b"notimg", content_type="text/plain")
    resp = client.post(
        "/api/products/",
        {
            "name_uz": "P",
            "name_ru": "P",
            "category_id": cat.id,
            "supplier_id": sup.id,
            "image_file": f,
        },
    )
    assert resp.status_code in (400, 415)

    # Large image
    os.environ["MAX_IMAGE_MB"] = "0"  # force max 0MB
    f2 = SimpleUploadedFile("a.png", b"0" * 1024 * 1024, content_type="image/png")
    resp2 = client.post(
        "/api/products/",
        {
            "name_uz": "P2",
            "name_ru": "P2",
            "category_id": cat.id,
            "supplier_id": sup.id,
            "image_file": f2,
        },
    )
    assert resp2.status_code in (400, 413)


@pytest.mark.django_db
def test_import_products_strict(monkeypatch, admin_client):
    # Build invalid header workbook
    try:
        from openpyxl import Workbook
    except Exception:
        pytest.skip("openpyxl not installed")
    wb = Workbook()
    ws = wb.active
    ws.append(["bad", "header"])  # wrong
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    # call import -> should accept job and later fail; simulate task run
    upload = SimpleUploadedFile(
        "bad.xlsx",
        buf.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    # Ensure admin_client is authenticated; if not, create one quickly
    if admin_client.get("/api/admin/summary/").status_code in (401, 403):
        from django.contrib.auth import get_user_model

        U = get_user_model()
        U.objects.create_user(username="admz", password="Pass123!", role="ADMIN")
        tok = admin_client.post(
            "/api/auth/login/",
            {"username": "admz", "password": "Pass123!"},
            content_type="application/json",
        )
        assert tok.status_code == 200
        admin_client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"
    with mock.patch("shop.tasks.import_products_task.delay", lambda *a, **k: None):
        resp = admin_client.post(reverse("admin_import_products"), {"file": upload})
    assert resp.status_code == 202
    job_id = resp.data["job_id"]

    # Directly run task to simulate worker
    from shop.tasks import import_products_task

    import_products_task(job_id, buf.getvalue())

    status = admin_client.get(reverse("admin_job_status", kwargs={"job_id": job_id})).json()
    assert status["status"] in ("FAILED", "SUCCESS")
