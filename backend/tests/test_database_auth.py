import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import (
    init_db,
    create_user,
    verify_user_credentials,
    get_user_by_email,
    get_user_by_id,
    hash_password,
    verify_password,
    upsert_room,
    close_room_in_db,
    get_room_from_db,
    create_call_log,
    get_call_logs,
    update_user_tier
)
from backend.auth_service import create_access_token, verify_access_token

client = TestClient(app)

@pytest.fixture
def temp_db():
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "test_voicebridge.db")
    init_db(db_path)
    yield db_path
    try:
        if os.path.exists(db_path):
            os.remove(db_path)
    except Exception:
        pass

def test_password_hashing():
    pwd = "SecretPassword123!"
    hashed = hash_password(pwd)
    assert "$" in hashed
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False
    assert verify_password("", hashed) is False
    assert verify_password(pwd, "") is False

def test_auto_seeded_demo_accounts(temp_db):
    op = verify_user_credentials("operator@voicebridge.com", "operator123", db_path=temp_db)
    assert op is not None
    assert op["role"] == "Operator"
    assert op["tier"] == "Pro"

    admin = verify_user_credentials("admin@voicebridge.com", "admin123", db_path=temp_db)
    assert admin is not None
    assert admin["role"] == "Administrator"
    assert admin["tier"] == "Enterprise"

def test_user_creation_and_retrieval(temp_db):
    user = create_user(
        email="analyst@voicebridge.com",
        password="Password456!",
        name="Security Analyst",
        role="Operator",
        tier="Community",
        db_path=temp_db
    )
    assert user["email"] == "analyst@voicebridge.com"

    by_email = get_user_by_email("analyst@voicebridge.com", db_path=temp_db)
    assert by_email is not None
    assert by_email["id"] == user["id"]

    by_id = get_user_by_id(user["id"], db_path=temp_db)
    assert by_id is not None
    assert by_id["name"] == "Security Analyst"

    # Tier update
    update_user_tier(user["id"], "Pro", db_path=temp_db)
    updated = get_user_by_id(user["id"], db_path=temp_db)
    assert updated["tier"] == "Pro"

def test_jwt_token_flow():
    payload = {"sub": "USR-9999", "email": "test@vb.com", "role": "Operator", "tier": "Pro"}
    token = create_access_token(payload, expires_in_seconds=3600)
    assert isinstance(token, str)
    assert len(token.split(".")) == 3

    verified = verify_access_token(token)
    assert verified is not None
    assert verified["sub"] == "USR-9999"
    assert verified["email"] == "test@vb.com"

    # Tampered token verification
    assert verify_access_token(token + "corrupt") is None

    # Expired token
    expired_token = create_access_token(payload, expires_in_seconds=-10)
    assert verify_access_token(expired_token) is None

def test_auth_rest_endpoints():
    import uuid
    unique_email = f"field_officer_{uuid.uuid4().hex[:8]}@voicebridge.com"

    # Register new user
    reg_res = client.post("/api/auth/register", json={
        "email": unique_email,
        "password": "fieldPassword123",
        "name": "Field Officer",
        "role": "Operator"
    })
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert reg_data["status"] == "success"
    assert "token" in reg_data

    # Duplicate registration should return 400
    dup_res = client.post("/api/auth/register", json={
        "email": unique_email,
        "password": "fieldPassword123"
    })
    assert dup_res.status_code == 400

    # Login with valid credentials
    login_res = client.post("/api/auth/login", json={
        "email": unique_email,
        "password": "fieldPassword123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]

    # Login with wrong credentials
    bad_login = client.post("/api/auth/login", json={
        "email": unique_email,
        "password": "wrongpassword"
    })
    assert bad_login.status_code == 401

    # Protected endpoint /api/auth/me
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == unique_email

    # Unauthenticated /api/auth/me returns 401
    unauth_res = client.get("/api/auth/me")
    assert unauth_res.status_code == 401

    # Logout
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200

def test_room_and_call_log_persistence(temp_db):
    upsert_room("ROOM-TACTICAL-01", created_by="operator1", status="active", db_path=temp_db)
    room = get_room_from_db("ROOM-TACTICAL-01", db_path=temp_db)
    assert room is not None
    assert room["status"] == "active"

    close_room_in_db("ROOM-TACTICAL-01", db_path=temp_db)
    closed = get_room_from_db("ROOM-TACTICAL-01", db_path=temp_db)
    assert closed["status"] == "closed"

    # Call log creation and listing
    log = create_call_log(
        room_id="ROOM-TACTICAL-01",
        caller_id="operator1",
        peer_id="guest2",
        duration_seconds=124,
        transcript_json=[{"speaker": "operator1", "originalText": "Hello", "translatedText": "Hola"}],
        db_path=temp_db
    )
    assert log["id"] is not None

    logs = get_call_logs(room_id="ROOM-TACTICAL-01", db_path=temp_db)
    assert len(logs) == 1
    assert logs[0]["duration_seconds"] == 124
    assert len(logs[0]["transcript"]) == 1
