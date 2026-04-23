"""Authentication endpoint - POST /api/auth."""
from __future__ import annotations

import hashlib
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _utils import create_token, handle_options, read_json_body, send_error, send_json, verify_token  # noqa: E402,F401

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


def _load_users() -> dict:
    env_users = os.getenv("AUTH_USERS_JSON")
    if env_users:
        try:
            return json.loads(env_users)
        except json.JSONDecodeError:
            return {}

    admin_password = os.getenv("ADMIN_PASSWORD")
    if admin_password:
        return {
            os.getenv("ADMIN_USERNAME", "admin").strip().lower(): {
                "password_hash": _hash_pw(admin_password),
                "display_name": os.getenv("ADMIN_DISPLAY_NAME", "Administrator"),
                "role": "admin",
            }
        }

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

    demo_default = "false" if os.getenv("VERCEL_ENV") == "production" else "true"
    if os.getenv("ALLOW_DEMO_USERS", demo_default).lower() == "true":
        return _DEFAULT_USERS
    return {}


def _hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


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

        try:
            token = create_token(username, record.get("role", "user"))
        except RuntimeError as exc:
            send_error(self, str(exc), 500)
            return

        send_json(self, {
            "token": token,
            "username": username,
            "display_name": record.get("display_name", username),
            "role": record.get("role", "user"),
        })

    def log_message(self, format, *args):
        pass
