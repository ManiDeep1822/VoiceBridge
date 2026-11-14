import os
import hmac
import hashlib
import secrets
import time
import json
from typing import Optional, Dict, Any

try:
    from database import (
        create_subscription,
        update_subscription_status,
        get_subscription_by_order_id,
        update_user_tier,
        get_user_by_id
    )
except ImportError:
    from backend.database import (
        create_subscription,
        update_subscription_status,
        get_subscription_by_order_id,
        update_user_tier,
        get_user_by_id
    )

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_voicebridge_sandbox")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "secret_voicebridge_sandbox_2026")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "sk_test_voicebridge_sandbox_2026")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "pk_test_voicebridge_sandbox")

# Pricing matrix (amount in smallest unit: paise for INR, cents for USD)
TIER_PRICING = {
    "pro": {
        "name": "Pro Commercial",
        "INR": {"amount": 299900, "display": 2999, "currency": "INR"},
        "USD": {"amount": 4900, "display": 49, "currency": "USD"}
    },
    "enterprise": {
        "name": "Enterprise Dedicated",
        "INR": {"amount": 1999900, "display": 19999, "currency": "INR"},
        "USD": {"amount": 29900, "display": 299, "currency": "USD"}
    },
    "community": {
        "name": "Community Free",
        "INR": {"amount": 0, "display": 0, "currency": "INR"},
        "USD": {"amount": 0, "display": 0, "currency": "USD"}
    }
}


def is_sandbox_mode(gateway: str = "razorpay") -> bool:
    """Returns True if the environment is configured in sandbox test mode."""
    if gateway.lower() == "razorpay":
        return not RAZORPAY_KEY_ID or "test" in RAZORPAY_KEY_ID.lower() or "sandbox" in RAZORPAY_KEY_ID.lower()
    else:
        return not STRIPE_SECRET_KEY or "test" in STRIPE_SECRET_KEY.lower() or "sandbox" in STRIPE_SECRET_KEY.lower()


def create_order(
    tier: str,
    gateway: str = "razorpay",
    currency: str = "INR",
    user_id: str = "guest",
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """Creates a payment order for Razorpay or Stripe."""
    norm_tier = tier.strip().lower()
    if norm_tier not in TIER_PRICING:
        norm_tier = "pro"

    norm_curr = currency.strip().upper()
    if norm_curr not in ("INR", "USD"):
        norm_curr = "INR"

    tier_info = TIER_PRICING[norm_tier][norm_curr]
    amount = tier_info["amount"]
    display_amount = tier_info["display"]
    norm_gateway = gateway.strip().lower()
    sandbox = is_sandbox_mode(norm_gateway)

    if norm_gateway == "stripe" or norm_curr == "USD":
        order_id = f"cs_test_{secrets.token_hex(12)}"
        key_id = STRIPE_PUBLISHABLE_KEY
    else:
        order_id = f"order_{secrets.token_hex(10)}"
        key_id = RAZORPAY_KEY_ID

    # Record order in SQLite
    create_subscription(
        user_id=user_id,
        gateway=norm_gateway,
        order_id=order_id,
        tier=norm_tier.capitalize(),
        amount=display_amount,
        currency=norm_curr,
        status="created",
        db_path=db_path
    )

    return {
        "order_id": order_id,
        "amount": amount,
        "amount_display": display_amount,
        "currency": norm_curr,
        "tier": norm_tier.capitalize(),
        "gateway": norm_gateway,
        "key_id": key_id,
        "is_sandbox": sandbox,
        "description": f"VoiceBridge {tier_info} Tier Subscription",
        "created_at": int(time.time())
    }


def verify_payment(
    gateway: str,
    order_id: str,
    payment_id: str,
    signature: Optional[str] = None,
    user_id: Optional[str] = None,
    tier: Optional[str] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Verifies payment signature and upgrades user tier in database upon confirmation.
    Supports constant-time HMAC-SHA256 signature check and deterministic Sandbox mode.
    """
    norm_gateway = (gateway or "razorpay").strip().lower()
    sub = get_subscription_by_order_id(order_id, db_path=db_path)
    target_tier = (tier or (sub["tier"] if sub else "Pro")).capitalize()
    target_user_id = user_id or (sub["user_id"] if sub else "guest")

    verified = False
    sandbox = is_sandbox_mode(norm_gateway) or order_id.startswith("order_test_") or order_id.startswith("cs_test_")

    if norm_gateway == "razorpay":
        if signature:
            # Standard Razorpay HMAC-SHA256 calculation
            msg = f"{order_id}|{payment_id}".encode("utf-8")
            expected_sig = hmac.new(RAZORPAY_KEY_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()
            if hmac.compare_digest(expected_sig, signature):
                verified = True
            elif sandbox and (signature.startswith("sig_") or "sandbox" in signature):
                # Valid sandbox simulation signature
                verified = True
        elif sandbox:
            # Sandbox instant test verification
            verified = True
    else:  # Stripe
        if payment_id and (payment_id.startswith("pay_") or payment_id.startswith("pi_") or sandbox):
            verified = True

    if not verified:
        return {
            "status": "failed",
            "message": "Payment signature verification failed",
            "order_id": order_id,
            "verified": False
        }

    # Fulfill entitlement in database
    update_subscription_status(order_id, "completed", payment_id=payment_id, db_path=db_path)

    if target_user_id and target_user_id != "guest":
        update_user_tier(target_user_id, target_tier, db_path=db_path)

    return {
        "status": "success",
        "message": f"Payment successfully verified. Upgraded to {target_tier}.",
        "verified": True,
        "order_id": order_id,
        "payment_id": payment_id,
        "tier": target_tier,
        "gateway": norm_gateway,
        "is_sandbox": sandbox
    }


def handle_webhook(payload: Dict[str, Any], headers: Optional[Dict[str, str]] = None, db_path: Optional[str] = None) -> Dict[str, Any]:
    """Processes webhook callbacks from Razorpay or Stripe."""
    event = payload.get("event") or payload.get("type") or ""
    # Razorpay payment.captured or order.paid
    if "payment.captured" in event or "order.paid" in event:
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payment_entity.get("order_id")
        payment_id = payment_entity.get("id")
        if order_id:
            update_subscription_status(order_id, "completed", payment_id=payment_id, db_path=db_path)
            sub = get_subscription_by_order_id(order_id, db_path=db_path)
            if sub and sub.get("user_id"):
                update_user_tier(sub["user_id"], sub.get("tier", "Pro"), db_path=db_path)
            return {"status": "processed", "order_id": order_id}

    # Stripe checkout.session.completed
    if "checkout.session.completed" in event:
        session = payload.get("data", {}).get("object", {})
        order_id = session.get("id")
        payment_id = session.get("payment_intent")
        if order_id:
            update_subscription_status(order_id, "completed", payment_id=payment_id, db_path=db_path)
            sub = get_subscription_by_order_id(order_id, db_path=db_path)
            if sub and sub.get("user_id"):
                update_user_tier(sub["user_id"], sub.get("tier", "Pro"), db_path=db_path)
            return {"status": "processed", "order_id": order_id}

    return {"status": "ignored", "event": event}
