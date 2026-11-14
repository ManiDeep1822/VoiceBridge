import os
import sys
import json
import time
import base64
import hmac
import hashlib
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

try:
    from database import get_user_by_id, get_user_by_email
except ImportError:
    from backend.database import get_user_by_id, get_user_by_email

SECRET_KEY = os.getenv("JWT_SECRET", "voicebridge-super-secret-key-2026-production")
ALGORITHM = "HS256"
DEFAULT_EXPIRATION_SECONDS = 86400 * 7  # 7 days

security_bearer = HTTPBearer(auto_error=False)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(s: str) -> bytes:
    padding = "=" * ((4 - len(s) % 4) % 4)
    return base64.urlsafe_b64decode(s + padding)


def create_access_token(data: Dict[str, Any], expires_in_seconds: int = DEFAULT_EXPIRATION_SECONDS) -> str:
    """Creates an HMAC-SHA256 signed JSON Web Token (JWT)."""
    now = int(time.time())
    payload = data.copy()
    payload.setdefault("iat", now)
    payload.setdefault("exp", now + expires_in_seconds)

    header = {"alg": ALGORITHM, "typ": "JWT"}
    header_json = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_json = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    header_b64 = _b64url_encode(header_json)
    payload_b64 = _b64url_encode(payload_json)

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def verify_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Verifies HMAC-SHA256 signature and expiration of JWT."""
    if not token or not isinstance(token, str):
        return None

    clean_token = token.strip()
    if clean_token.lower().startswith("bearer "):
        clean_token = clean_token[7:].strip()

    parts = clean_token.split(".")
    if len(parts) != 3:
        return None

    header_b64, payload_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()

    try:
        actual_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload_bytes = _b64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))

        # Verify expiration
        exp = payload.get("exp")
        if exp is not None and int(exp) < int(time.time()):
            return None

        return payload
    except Exception:
        return None


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    authorization: Optional[str] = Header(None)
) -> Optional[Dict[str, Any]]:
    """Extracts user profile if valid bearer token is present, else returns None."""
    token = None
    if credentials:
        token = credentials.credentials
    elif authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()

    if not token:
        return None

    payload = verify_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub") or payload.get("id")
    email = payload.get("email")

    user = None
    if user_id:
        user = get_user_by_id(str(user_id))
    if not user and email:
        user = get_user_by_email(str(email))

    if user:
        clean_user = dict(user)
        clean_user.pop("password_hash", None)
        return clean_user

    # If user record was deleted or not found, but token payload is valid
    return {
        "id": user_id or f"usr_{email}",
        "email": email or "",
        "name": payload.get("name", "User"),
        "role": payload.get("role", "Operator"),
        "tier": payload.get("tier", "Community")
    }


async def get_current_user(
    user: Optional[Dict[str, Any]] = Depends(get_optional_current_user)
) -> Dict[str, Any]:
    """Strict FastAPI dependency requiring a valid Bearer token."""
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
