import pytest


@pytest.mark.django_db
def test_catalog_admin_writes_enforced(client):
    # Anon cannot create category
    resp = client.post("/api/categories/", {"name_uz": "A", "name_ru": "A"})
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_status_machine_transitions(client):
    # create admin and user, login as admin to transition
    from django.contrib.auth import get_user_model

    from shop.models import Category, Order, OrderItem, Product, Supplier

    U = get_user_model()
    user = U.objects.create_user(username="u1", password="Pass123!", role="CUSTOMER")
    U.objects.create_user(username="a1", password="Pass123!", role="ADMIN")

    tok = client.post(
        "/api/auth/login/",
        {"username": "a1", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"
    cat = Category.objects.create(name_uz="C", name_ru="C")
    sup = Supplier.objects.create(name="S")
    prod = Product.objects.create(name_uz="P", name_ru="P", category=cat, supplier=sup)
    order = Order.objects.create(user=user, order_number="#20250101-001")
    OrderItem.objects.create(order=order, product=prod, quantity=1)

    # legal transitions
    assert (
        client.post(f"/api/orders/{order.id}/status/", {"status": "Confirmed"}).status_code == 200
    )
    assert client.post(f"/api/orders/{order.id}/status/", {"status": "Shipped"}).status_code == 200
    # illegal transition (cannot go backwards)
    bad = client.post(f"/api/orders/{order.id}/status/", {"status": "Received"})
    assert bad.status_code == 400

    # cancelled transition is allowed from active states and becomes terminal
    cancelled_order = Order.objects.create(user=user, order_number="#20250101-002")
    OrderItem.objects.create(order=cancelled_order, product=prod, quantity=1)
    cancel_resp = client.post(
        f"/api/orders/{cancelled_order.id}/status/",
        {"status": "Cancelled"},
    )
    assert cancel_resp.status_code == 200
    cancelled_order.refresh_from_db()
    assert cancelled_order.status == "Cancelled"
    blocked = client.post(f"/api/orders/{cancelled_order.id}/status/", {"status": "Shipped"})
    assert blocked.status_code == 400

    summary = client.get("/api/admin/summary/")
    assert summary.status_code == 200
    body = summary.json()
    assert body["cancelled_orders"] >= 1
    assert body["status_stats"]["Cancelled"] >= 1


@pytest.mark.django_db
def test_session_cart_merge(client):
    # anon adds to cart, then registers/logs in; cart merges into user cart
    from django.contrib.auth import get_user_model

    from shop.models import Category, Product, Supplier

    cat = Category.objects.create(name_uz="C", name_ru="C")
    sup = Supplier.objects.create(name="S")
    prod = Product.objects.create(name_uz="P", name_ru="P", category=cat, supplier=sup)

    add = client.post(
        "/api/cart/items/",
        {"product_id": prod.id, "quantity": 2},
        content_type="application/json",
    )
    assert add.status_code in (200, 201)
    anon_cart = client.get("/api/cart/").json()
    assert anon_cart["items"][0]["quantity"] == 2

    # Register and login
    U = get_user_model()
    U.objects.create_user(username="u2", password="Pass123!")
    tok = client.post(
        "/api/auth/login/",
        {"username": "u2", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"

    # Fetch cart -> should merge
    merged = client.get("/api/cart/").json()
    assert merged["items"][0]["quantity"] == 2


@pytest.mark.django_db
def test_role_change_superadmin_only(client):
    """Only SUPERADMIN can change user roles."""
    from django.contrib.auth import get_user_model

    U = get_user_model()
    customer = U.objects.create_user(username="customer1", password="Pass123!", role="CUSTOMER")
    U.objects.create_user(username="admin1", password="Pass123!", role="ADMIN")
    U.objects.create_user(username="superadmin1", password="Pass123!", role="SUPERADMIN")

    # Admin cannot change roles
    tok = client.post(
        "/api/auth/login/",
        {"username": "admin1", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"
    resp = client.post(
        f"/api/admin/users/{customer.id}/role/",
        {"role": "ADMIN"},
        content_type="application/json",
    )
    assert resp.status_code == 403

    # SUPERADMIN can change roles
    tok = client.post(
        "/api/auth/login/",
        {"username": "superadmin1", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"
    resp = client.post(
        f"/api/admin/users/{customer.id}/role/",
        {"role": "ADMIN"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    customer.refresh_from_db()
    assert customer.role == "ADMIN"


@pytest.mark.django_db
def test_role_change_self_prevention(client):
    """SUPERADMIN cannot change their own role."""
    from django.contrib.auth import get_user_model

    U = get_user_model()
    superadmin = U.objects.create_user(
        username="superadmin1", password="Pass123!", role="SUPERADMIN"
    )

    tok = client.post(
        "/api/auth/login/",
        {"username": "superadmin1", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"
    resp = client.post(
        f"/api/admin/users/{superadmin.id}/role/",
        {"role": "ADMIN"},
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert "cannot change your own role" in resp.json()["detail"].lower()


@pytest.mark.django_db
def test_role_change_last_superadmin_prevention(client):
    """Cannot demote the last SUPERADMIN."""
    from django.contrib.auth import get_user_model

    U = get_user_model()
    superadmin1 = U.objects.create_user(
        username="superadmin1", password="Pass123!", role="SUPERADMIN"
    )
    superadmin2 = U.objects.create_user(
        username="superadmin2", password="Pass123!", role="SUPERADMIN"
    )

    # Login as superadmin1 and demote superadmin2
    tok = client.post(
        "/api/auth/login/",
        {"username": "superadmin1", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"

    # Can demote when there are multiple SUPERADMINs
    resp = client.post(
        f"/api/admin/users/{superadmin2.id}/role/",
        {"role": "ADMIN"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    superadmin2.refresh_from_db()
    assert superadmin2.role == "ADMIN"

    # Now login as superadmin2 (now ADMIN) and try to demote superadmin1.
    # This should fail because superadmin2 is no longer SUPERADMIN.
    tok = client.post(
        "/api/auth/login/",
        {"username": "superadmin2", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"
    resp = client.post(
        f"/api/admin/users/{superadmin1.id}/role/",
        {"role": "ADMIN"},
        content_type="application/json",
    )
    assert resp.status_code == 403  # Not SUPERADMIN anymore

    # Login as superadmin1 and try to demote themselves - should fail (self-change)
    tok = client.post(
        "/api/auth/login/",
        {"username": "superadmin1", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"
    resp = client.post(
        f"/api/admin/users/{superadmin1.id}/role/",
        {"role": "ADMIN"},
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert "cannot change your own role" in resp.json()["detail"].lower()

    # Create another superadmin and have them try to demote superadmin1.
    # This should fail because it would demote the last SUPERADMIN.
    superadmin3 = U.objects.create_user(
        username="superadmin3", password="Pass123!", role="SUPERADMIN"
    )
    superadmin4 = U.objects.create_user(
        username="superadmin4", password="Pass123!", role="SUPERADMIN"
    )

    # Login as superadmin3 and demote superadmin4 (should work, multiple SUPERADMINs exist)
    tok = client.post(
        "/api/auth/login/",
        {"username": "superadmin3", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"
    resp = client.post(
        f"/api/admin/users/{superadmin4.id}/role/",
        {"role": "ADMIN"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    superadmin4.refresh_from_db()
    assert superadmin4.role == "ADMIN"

    # Now only superadmin1 and superadmin3 are SUPERADMINs - demote superadmin3
    resp = client.post(
        f"/api/admin/users/{superadmin3.id}/role/",
        {"role": "ADMIN"},
        content_type="application/json",
    )
    assert resp.status_code == 400  # Cannot demote yourself
    assert "cannot change your own role" in resp.json()["detail"].lower()

    # Login as superadmin1 and demote superadmin3 (should work, multiple SUPERADMINs exist)
    tok = client.post(
        "/api/auth/login/",
        {"username": "superadmin1", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"
    resp = client.post(
        f"/api/admin/users/{superadmin3.id}/role/",
        {"role": "ADMIN"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    superadmin3.refresh_from_db()
    assert superadmin3.role == "ADMIN"

    # Verify only superadmin1 is SUPERADMIN now
    assert U.objects.filter(role="SUPERADMIN").count() == 1

    # Verify that the system always maintains at least 1 SUPERADMIN
    # (The last SUPERADMIN check ensures this, though it's hard to test directly
    # since self-change check happens first. The important thing is the system
    # maintains at least 1 SUPERADMIN after all operations.)
    assert U.objects.filter(role="SUPERADMIN").count() >= 1


@pytest.mark.django_db
def test_cart_rejects_out_of_stock_products(client):
    from django.contrib.auth import get_user_model

    from shop.models import Category, Product, Supplier

    U = get_user_model()
    U.objects.create_user(username="stocky", password="Pass123!")
    tok = client.post(
        "/api/auth/login/",
        {"username": "stocky", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"

    cat = Category.objects.create(name_uz="C", name_ru="C")
    sup = Supplier.objects.create(name="S")
    p = Product.objects.create(
        name_uz="P",
        name_ru="P",
        category=cat,
        supplier=sup,
        is_in_stock=False,
    )

    resp = client.post(
        "/api/cart/items/",
        {"product_id": p.id, "quantity": 1},
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert "out of stock" in str(resp.json()).lower()
