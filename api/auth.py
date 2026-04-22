"""Authentication endpoint — POST /api/auth

Request body:
    { "username": "admin", "password": "admin123" }

Response (200):
    { "token": "...", "username": "admin", "display_name": "Administrator", "role": "admin" }

Response (401):
    { "error": "Invalid credentials." }
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler

# Resolve project root so _utils can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _utils import handle_options, read_json_body, send_error, send_json  # noqa: E402

# ---------------------------------------------------------------------------
# User store
# ---------------------------------------------------------------------------

_DEFAULT_USERS: dict[str, dict] = {
    "admin": {
        "password_hash": hashlib.sha256(b"admin123").hexdigest(),
        "display_name": "Administrator",
        "role": "admin",
    },
    "analyst": {
        "password_hash": hashlib.sha256(b"analyst123").hexdigest(),
        "display_name": "Business Analyst",
        "role": "analyst",
    },
}

_SECRET = os.getenv("AUTH_SECRET", "apex-analytics-secret-key-change-in-production")


def _load_users() -> dict:
    users_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "users.json",
    )
    if os.path.exists(users_path):
        try:
            with open(users_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return _DEFAULT_USERS


def _hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Token helpers (simple HMAC — no external JWT library required)
# ---------------------------------------------------------------------------

def _create_token(username: str, role: str) -> str:
    payload = f"{username}:{role}:{int(time.time())}"
    sig = hmac.new(_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def verify_token(token: str) -> dict | None:
    """Validate token and return ``{"username": ..., "role": ...}`` or None."""
    try:
        parts = token.split(":")
        if len(parts) != 4:
            return None
        username, role, ts, sig = parts
        payload = f"{username}:{role}:{ts}"
        expected = hmac.new(_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        # 24-hour expiry
        if int(time.time()) - int(ts) > 86_400:
            return None
        return {"username": username, "role": role}
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Vercel handler
# ---------------------------------------------------------------------------

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self)

    def do_POST(self):
        data = read_json_body(self)
        username = str(data.get("username", "")).strip().lower()
        password = str(data.get("password", ""))

        if not username or not password:
            send_error(self, "Username and password are required.", 400)
            return

        users = _load_users()
        record = users.get(username)
        if record is None or record.get("password_hash") != _hash_pw(password):
            send_error(self, "Invalid credentials.", 401)
            return

        token = _create_token(username, record.get("role", "user"))
        send_json(self, {
            "token": token,
            "username": username,
            "display_name": record.get("display_name", username),
            "role": record.get("role", "user"),
        })

    def log_message(self, format, *args):  # suppress access logs
        pass
