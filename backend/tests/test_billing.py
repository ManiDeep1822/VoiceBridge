import hmac
import hashlib
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_user_by_id, create_user
from backend.services.billing import RAZORPAY_KEY_SECRET

client = TestClient(app)

def test_create_order_razorpay_and_stripe():
    # Razorpay INR Pro
    res_rzp = client.post("/api/billing/create-order", json={
        "tier": "pro",
        "gateway": "razorpay",
        "currency": "INR",
        "user_id": "USR-1001"
    })
    assert res_rzp.status_code == 200
    rzp_data = res_rzp.json()
    assert rzp_data["amount_display"] == 2999
    assert rzp_data["currency"] == "INR"
    assert rzp_data["gateway"] == "razorpay"
    assert rzp_data["order_id"].startswith("order_")
    assert rzp_data["is_sandbox"] is True

    # Stripe USD Enterprise
    res_stripe = client.post("/api/billing/create-order", json={
        "tier": "enterprise",
        "gateway": "stripe",
        "currency": "USD",
        "user_id": "USR-1001"
    })
    assert res_stripe.status_code == 200
    stripe_data = res_stripe.json()
    assert stripe_data["amount_display"] == 299
    assert stripe_data["currency"] == "USD"
    assert stripe_data["gateway"] == "stripe"
    assert stripe_data["order_id"].startswith("cs_test_")

def test_verify_payment_and_tier_upgrade():
    import uuid
    unique_email = f"billing_test_{uuid.uuid4().hex[:8]}@voicebridge.com"
    # Create test user with Community tier
    user = create_user(
        email=unique_email,
        password="Password123!",
        name="Billing Test User",
        role="Operator",
        tier="Community"
    )
    user_id = user["id"]

    # Create Pro order
    order_res = client.post("/api/billing/create-order", json={
        "tier": "pro",
        "gateway": "razorpay",
        "currency": "INR",
        "user_id": user_id
    })
    order_id = order_res.json()["order_id"]
    payment_id = "pay_test_succ_1001"

    # Compute valid HMAC-SHA256 signature
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    valid_sig = hmac.new(RAZORPAY_KEY_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    # Verify payment with valid signature
    verify_res = client.post("/api/billing/verify-payment", json={
        "gateway": "razorpay",
        "order_id": order_id,
        "payment_id": payment_id,
        "signature": valid_sig,
        "user_id": user_id,
        "tier": "pro"
    })
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["status"] == "success"
    assert verify_data["tier"] == "Pro"

    # Check user tier was upgraded in DB
    updated_user = get_user_by_id(user_id)
    assert updated_user["tier"] == "Pro"

def test_verify_payment_sandbox_mode():
    import uuid
    sandbox_email = f"sandbox_user_{uuid.uuid4().hex[:8]}@voicebridge.com"
    user = create_user(
        email=sandbox_email,
        password="Password123!",
        name="Sandbox User",
        role="Operator",
        tier="Community"
    )
    order_res = client.post("/api/billing/create-order", json={
        "tier": "enterprise",
        "gateway": "razorpay",
        "currency": "INR",
        "user_id": user["id"]
    })
    order_id = order_res.json()["order_id"]

    # Verify sandbox payment
    verify_res = client.post("/api/billing/verify-payment", json={
        "gateway": "razorpay",
        "order_id": order_id,
        "payment_id": "pay_sandbox_enterprise",
        "signature": "sig_sandbox_valid",
        "user_id": user["id"],
        "tier": "enterprise"
    })
    assert verify_res.status_code == 200
    assert verify_res.json()["tier"] == "Enterprise"

    updated = get_user_by_id(user["id"])
    assert updated["tier"] == "Enterprise"

def test_billing_webhook_handler():
    webhook_payload = {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_hook_999",
                    "order_id": "order_non_existent",
                    "amount": 299900,
                    "currency": "INR"
                }
            }
        }
    }
    res = client.post("/api/billing/webhook", json=webhook_payload)
    assert res.status_code == 200
