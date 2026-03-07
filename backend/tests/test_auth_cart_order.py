import re

import pytest


@pytest.mark.django_db
def test_register_login_me_update_cart_order_whatsapp(client):
    # Register user
    reg = client.post(
        "/api/auth/register/",
        {
            "username": "alice",
            "email": "alice@example.com",
            "password": "Strongpass123!",
            "user_type": "INDIVIDUAL",
            "fio": "Alice",
            "phone": "+998900000001",
            "address": "Yunusabad",
        },
        content_type="application/json",
    )
    assert reg.status_code == 201

    # Login
    tok = client.post(
        "/api/auth/login/",
        {"username": "alice", "password": "Strongpass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    access = tok.json()["access"]
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {access}"

    # Me
    me = client.get("/api/auth/me/")
    assert me.status_code == 200
    assert me.json()["username"] == "alice"

    # Update profile
    up = client.put(
        "/api/auth/me/",
        {"address": "Tashkent"},
        content_type="application/json",
    )
    assert up.status_code == 200
    assert up.json()["address"] == "Tashkent"

    # Seed catalog
    from shop.models import Category, Product, Supplier

    cat = Category.objects.create(name_uz="Oyog'", name_ru="Нога")
    sup = Supplier.objects.create(name="Local Farm")
    prod = Product.objects.create(
        name_uz="Tovuq oyog'i", name_ru="Куриная ножка", category=cat, supplier=sup
    )

    # Add to cart
    add = client.post(
        "/api/cart/items/",
        {"product_id": prod.id, "quantity": 3},
        content_type="application/json",
    )
    assert add.status_code in (200, 201)
    cart = client.get("/api/cart/")
    assert cart.status_code == 200
    assert cart.json()["items"][0]["quantity"] == 3

    # Create order (no prices)
    order_resp = client.post("/api/orders/")
    assert order_resp.status_code == 201
    order = order_resp.json()
    assert order["order_number"].startswith("#")
    assert re.match(r"^#\d{8}-\d{3}$", order["order_number"]) is not None
    assert "items" in order and len(order["items"]) == 1

    # WhatsApp helper
    order_id = order_resp.json()["id"]
    wa = client.get(f"/api/telegram/message-template/?orderId={order_id}")
    assert wa.status_code == 200
    payload = wa.json()
    text = payload["text"]
    assert payload["order_number"] == order["order_number"]
    assert "prices" in text.lower()  # mentions negotiation but not actual prices
    assert "tovuq" in text.lower()


@pytest.mark.django_db
def test_registration_field_requirements(client):
    # Individual missing address should fail
    resp = client.post(
        "/api/auth/register/",
        {
            "username": "ind1",
            "password": "Strongpass123!",
            "user_type": "INDIVIDUAL",
            "fio": "Ind User",
            "phone": "+998900000002",
        },
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert "address" in resp.json()

    # Legal entity must supply company/legal info and email
    bad_legal = client.post(
        "/api/auth/register/",
        {
            "username": "legal1",
            "password": "Strongpass123!",
            "user_type": "LEGAL",
            "phone": "+998900000003",
        },
        content_type="application/json",
    )
    assert bad_legal.status_code == 400
    assert "company_name" in bad_legal.json()

    good_legal = client.post(
        "/api/auth/register/",
        {
            "username": "legal2",
            "password": "Strongpass123!",
            "user_type": "LEGAL",
            "phone": "+998900000004",
            "company_name": "Halal Co",
            "responsible_person": "Boss",
            "address": "Tashkent",
            "legal_address": "Legal Addr",
            "inn": "123456789",
            "bank_details": "ACC123 BANK987",
            "email": "biz@example.com",
        },
        content_type="application/json",
    )
    assert good_legal.status_code == 201


@pytest.mark.django_db
def test_reorder_to_user_cart(client):
    from django.contrib.auth import get_user_model
    from shop.models import Category, Order, OrderItem, Product, Supplier

    U = get_user_model()
    user = U.objects.create_user(username="r1", password="Pass123!")
    tok = client.post(
        "/api/auth/login/",
        {"username": "r1", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"

    cat = Category.objects.create(name_uz="C", name_ru="C")
    sup = Supplier.objects.create(name="S")
    p = Product.objects.create(name_uz="P", name_ru="P", category=cat, supplier=sup)
    order = Order.objects.create(user=user, order_number="#20250101-001")
    OrderItem.objects.create(order=order, product=p, quantity=2)

    resp = client.post(f"/api/orders/{order.id}/reorder/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"][0]["quantity"] == 2


@pytest.mark.django_db
def test_reorder_unauthorized_for_anonymous(client):
    from django.contrib.auth import get_user_model
    from shop.models import Category, Order, OrderItem, Product, Supplier

    U = get_user_model()
    user = U.objects.create_user(username="r2", password="Pass123!")
    cat = Category.objects.create(name_uz="C", name_ru="C")
    sup = Supplier.objects.create(name="S")
    p = Product.objects.create(name_uz="P", name_ru="P", category=cat, supplier=sup)
    order = Order.objects.create(user=user, order_number="#20250101-002")
    OrderItem.objects.create(order=order, product=p, quantity=3)

    # Anonymous cannot access reorder endpoint at all (auth required)
    resp = client.post(f"/api/orders/{order.id}/reorder/")
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_reorder_forbidden_other_user(client):
    from django.contrib.auth import get_user_model
    from shop.models import Category, Order, OrderItem, Product, Supplier

    U = get_user_model()
    owner = U.objects.create_user(username="owner", password="Pass123!")
    U.objects.create_user(username="intruder", password="Pass123!")
    tok = client.post(
        "/api/auth/login/",
        {"username": "intruder", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"

    cat = Category.objects.create(name_uz="C", name_ru="C")
    sup = Supplier.objects.create(name="S")
    p = Product.objects.create(name_uz="P", name_ru="P", category=cat, supplier=sup)
    order = Order.objects.create(user=owner, order_number="#20250101-003")
    OrderItem.objects.create(order=order, product=p, quantity=1)

    resp = client.post(f"/api/orders/{order.id}/reorder/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_reorder_accumulates_quantities(client):
    from django.contrib.auth import get_user_model
    from shop.models import Category, Order, OrderItem, Product, Supplier

    U = get_user_model()
    user = U.objects.create_user(username="r3", password="Pass123!")
    tok = client.post(
        "/api/auth/login/",
        {"username": "r3", "password": "Pass123!"},
        content_type="application/json",
    )
    assert tok.status_code == 200
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {tok.json()['access']}"

    cat = Category.objects.create(name_uz="C", name_ru="C")
    sup = Supplier.objects.create(name="S")
    p = Product.objects.create(name_uz="P", name_ru="P", category=cat, supplier=sup)
    order = Order.objects.create(user=user, order_number="#20250101-004")
    OrderItem.objects.create(order=order, product=p, quantity=2)

    # First reorder
    resp1 = client.post(f"/api/orders/{order.id}/reorder/")
    assert resp1.status_code == 200
    q1 = resp1.json()["items"][0]["quantity"]
    assert q1 == 2
    # Second reorder adds to existing cart item
    resp2 = client.post(f"/api/orders/{order.id}/reorder/")
    assert resp2.status_code == 200
    q2 = resp2.json()["items"][0]["quantity"]
    assert q2 == 4
