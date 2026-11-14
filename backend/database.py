import os
import sqlite3
import secrets
import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

DB_PATH = os.getenv("VOICEBRIDGE_DB_PATH")
if not DB_PATH:
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voicebridge.db")


def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = db_path or DB_PATH
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def hash_password(password: str) -> str:
    """Salt + SHA-256 password hashing."""
    salt = secrets.token_hex(16)
    hash_hex = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return f"{salt}${hash_hex}"


def verify_password(password: str, hashed_password: str) -> bool:
    """Constant-time verification of password against salt$hash."""
    if not hashed_password or "$" not in hashed_password:
        return False
    try:
        salt, expected_hash = hashed_password.split("$", 1)
        actual_hash = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
        return hmac.compare_digest(actual_hash, expected_hash)
    except Exception:
        return False


def init_db(db_path: Optional[str] = None):
    """Initializes tables and seeds default accounts."""
    conn = get_connection(db_path)
    try:
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'Operator',
                    tier TEXT NOT NULL DEFAULT 'Community',
                    created_at TEXT NOT NULL
                );
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS rooms (
                    room_id TEXT PRIMARY KEY,
                    created_by TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    max_participants INTEGER DEFAULT 2,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS call_logs (
                    id TEXT PRIMARY KEY,
                    room_id TEXT,
                    caller_id TEXT,
                    peer_id TEXT,
                    duration_seconds INTEGER DEFAULT 0,
                    started_at TEXT,
                    ended_at TEXT,
                    transcript_json TEXT DEFAULT '[]'
                );
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    gateway TEXT NOT NULL,
                    order_id TEXT UNIQUE,
                    payment_id TEXT,
                    tier TEXT NOT NULL,
                    amount REAL DEFAULT 0.0,
                    currency TEXT DEFAULT 'INR',
                    status TEXT NOT NULL DEFAULT 'created',
                    created_at TEXT NOT NULL
                );
            """)

            # Seed default demo accounts
            now = datetime.now(timezone.utc).isoformat()

            # Demo Operator
            cursor = conn.execute("SELECT id FROM users WHERE email = ?", ("operator@voicebridge.com",))
            if not cursor.fetchone():
                conn.execute(
                    """
                    INSERT INTO users (id, email, password_hash, name, role, tier, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "USR-1001",
                        "operator@voicebridge.com",
                        hash_password("operator123"),
                        "Demo Operator",
                        "Operator",
                        "Pro",
                        now
                    )
                )

            # Demo Admin
            cursor = conn.execute("SELECT id FROM users WHERE email = ?", ("admin@voicebridge.com",))
            if not cursor.fetchone():
                conn.execute(
                    """
                    INSERT INTO users (id, email, password_hash, name, role, tier, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "ADM-7042",
                        "admin@voicebridge.com",
                        hash_password("admin123"),
                        "System Administrator",
                        "Administrator",
                        "Enterprise",
                        now
                    )
                )
    finally:
        conn.close()


def create_user(
    email: str,
    password: str,
    name: str,
    role: str = "Operator",
    tier: str = "Community",
    user_id: Optional[str] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    conn = get_connection(db_path)
    uid = user_id or f"usr_{secrets.token_hex(6)}"
    pw_hash = hash_password(password)
    now = datetime.now(timezone.utc).isoformat()
    clean_email = email.strip().lower()
    try:
        with conn:
            conn.execute(
                """
                INSERT INTO users (id, email, password_hash, name, role, tier, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (uid, clean_email, pw_hash, name.strip(), role, tier, now)
            )
        return {
            "id": uid,
            "email": clean_email,
            "name": name.strip(),
            "role": role,
            "tier": tier,
            "created_at": now
        }
    finally:
        conn.close()


def get_user_by_email(email: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection(db_path)
    clean_email = email.strip().lower()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (clean_email,)).fetchone()
        if row:
            return dict(row)
        return None
    finally:
        conn.close()


def get_user_by_id(user_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if row:
            return dict(row)
        return None
    finally:
        conn.close()


def verify_user_credentials(email: str, password: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    user = get_user_by_email(email, db_path=db_path)
    if not user:
        return None
    if verify_password(password, user["password_hash"]):
        user_dict = dict(user)
        user_dict.pop("password_hash", None)
        return user_dict
    return None


def update_user_tier(user_id_or_email: str, new_tier: str, db_path: Optional[str] = None) -> bool:
    conn = get_connection(db_path)
    try:
        with conn:
            cursor = conn.execute(
                "UPDATE users SET tier = ? WHERE id = ? OR email = ?",
                (new_tier, user_id_or_email, user_id_or_email.lower())
            )
            return cursor.rowcount > 0
    finally:
        conn.close()


def upsert_room(
    room_id: str,
    created_by: Optional[str] = None,
    status: str = "active",
    max_participants: int = 2,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    conn = get_connection(db_path)
    now = datetime.now(timezone.utc).isoformat()
    try:
        with conn:
            conn.execute(
                """
                INSERT INTO rooms (room_id, created_by, status, max_participants, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(room_id) DO UPDATE SET
                    status = excluded.status,
                    updated_at = excluded.updated_at
                """,
                (room_id, created_by, status, max_participants, now, now)
            )
        return {
            "room_id": room_id,
            "created_by": created_by,
            "status": status,
            "max_participants": max_participants,
            "updated_at": now
        }
    finally:
        conn.close()


def close_room_in_db(room_id: str, db_path: Optional[str] = None) -> bool:
    conn = get_connection(db_path)
    now = datetime.now(timezone.utc).isoformat()
    try:
        with conn:
            cursor = conn.execute(
                "UPDATE rooms SET status = 'closed', updated_at = ? WHERE room_id = ?",
                (now, room_id)
            )
            return cursor.rowcount > 0
    finally:
        conn.close()


def get_room_from_db(room_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT * FROM rooms WHERE room_id = ?", (room_id,)).fetchone()
        if row:
            return dict(row)
        return None
    finally:
        conn.close()


def list_rooms_from_db(status: Optional[str] = None, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    try:
        if status:
            rows = conn.execute("SELECT * FROM rooms WHERE status = ? ORDER BY updated_at DESC", (status,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM rooms ORDER BY updated_at DESC").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def create_call_log(
    room_id: str,
    caller_id: Optional[str] = None,
    peer_id: Optional[str] = None,
    duration_seconds: int = 0,
    started_at: Optional[str] = None,
    ended_at: Optional[str] = None,
    transcript_json: Any = "[]",
    log_id: Optional[str] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    conn = get_connection(db_path)
    cid = log_id or f"log_{secrets.token_hex(8)}"
    now = datetime.now(timezone.utc).isoformat()
    start = started_at or now
    end = ended_at or now

    if not isinstance(transcript_json, str):
        t_str = json.dumps(transcript_json)
    else:
        t_str = transcript_json

    try:
        with conn:
            conn.execute(
                """
                INSERT INTO call_logs (id, room_id, caller_id, peer_id, duration_seconds, started_at, ended_at, transcript_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (cid, room_id, caller_id, peer_id, int(duration_seconds), start, end, t_str)
            )
        return {
            "id": cid,
            "room_id": room_id,
            "caller_id": caller_id,
            "peer_id": peer_id,
            "duration_seconds": duration_seconds,
            "started_at": start,
            "ended_at": end,
            "transcript_json": t_str
        }
    finally:
        conn.close()


def get_call_logs(
    user_id: Optional[str] = None,
    room_id: Optional[str] = None,
    limit: int = 50,
    db_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    conn = get_connection(db_path)
    try:
        query = "SELECT * FROM call_logs"
        params = []
        conditions = []
        if user_id:
            conditions.append("(caller_id = ? OR peer_id = ?)")
            params.extend([user_id, user_id])
        if room_id:
            conditions.append("room_id = ?")
            params.append(room_id)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY started_at DESC LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, tuple(params)).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            try:
                d["transcript"] = json.loads(d.get("transcript_json") or "[]")
            except Exception:
                d["transcript"] = []
            result.append(d)
        return result
    finally:
        conn.close()


def create_subscription(
    user_id: str,
    gateway: str,
    order_id: str,
    tier: str,
    amount: float = 0.0,
    currency: str = "INR",
    status: str = "created",
    payment_id: Optional[str] = None,
    sub_id: Optional[str] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    conn = get_connection(db_path)
    sid = sub_id or f"sub_{secrets.token_hex(8)}"
    now = datetime.now(timezone.utc).isoformat()
    try:
        with conn:
            conn.execute(
                """
                INSERT INTO subscriptions (id, user_id, gateway, order_id, payment_id, tier, amount, currency, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (sid, user_id, gateway.lower(), order_id, payment_id, tier, float(amount), currency.upper(), status, now)
            )
        return {
            "id": sid,
            "user_id": user_id,
            "gateway": gateway.lower(),
            "order_id": order_id,
            "payment_id": payment_id,
            "tier": tier,
            "amount": amount,
            "currency": currency.upper(),
            "status": status,
            "created_at": now
        }
    finally:
        conn.close()


def update_subscription_status(
    order_id: str,
    status: str,
    payment_id: Optional[str] = None,
    db_path: Optional[str] = None
) -> bool:
    conn = get_connection(db_path)
    try:
        with conn:
            if payment_id:
                cursor = conn.execute(
                    "UPDATE subscriptions SET status = ?, payment_id = ? WHERE order_id = ?",
                    (status, payment_id, order_id)
                )
            else:
                cursor = conn.execute(
                    "UPDATE subscriptions SET status = ? WHERE order_id = ?",
                    (status, order_id)
                )
            return cursor.rowcount > 0
    finally:
        conn.close()


def get_subscription_by_order_id(order_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT * FROM subscriptions WHERE order_id = ?", (order_id,)).fetchone()
        if row:
            return dict(row)
        return None
    finally:
        conn.close()
