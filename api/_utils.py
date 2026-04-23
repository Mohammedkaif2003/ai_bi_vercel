"""Shared utilities for Vercel Python serverless functions.

All handler modules import from this file.  It also ensures the project
root is on sys.path so that ``from modules.xxx import yyy`` resolves
correctly inside each serverless function.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import io
import json
import os
import sys
import time

# Ensure project root is on the path so that modules/ can be imported
# from any function file inside api/.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

# Also add api/ itself so that ``from _utils import ...`` works when api/
# is the working directory.
_API_DIR = os.path.dirname(os.path.abspath(__file__))
if _API_DIR not in sys.path:
    sys.path.insert(0, _API_DIR)


# ---------------------------------------------------------------------------
# CORS + response helpers
# ---------------------------------------------------------------------------

MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", str(8 * 1024 * 1024)))
MAX_CSV_BYTES = int(os.getenv("MAX_CSV_BYTES", str(6 * 1024 * 1024)))
MAX_CSV_ROWS = int(os.getenv("MAX_CSV_ROWS", "20000"))
MAX_CSV_COLUMNS = int(os.getenv("MAX_CSV_COLUMNS", "200"))
TOKEN_TTL_SECONDS = int(os.getenv("AUTH_TOKEN_TTL_SECONDS", "86400"))


def _add_cors_headers(handler) -> None:
    origin = handler.headers.get("Origin")
    allowed = [
        item.strip()
        for item in os.getenv("ALLOWED_ORIGINS", "").split(",")
        if item.strip()
    ]
    if origin and origin in allowed:
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Vary", "Origin")
    elif not allowed:
        handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
    )


def handle_options(handler) -> None:
    """Reply to a CORS pre-flight OPTIONS request."""
    handler.send_response(200)
    _add_cors_headers(handler)
    handler.end_headers()


def send_json(handler, data, status: int = 200) -> None:
    body = json.dumps(data, default=_json_default).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    _add_cors_headers(handler)
    handler.end_headers()
    handler.wfile.write(body)


def send_error(handler, message: str, status: int = 400) -> None:
    send_json(handler, {"error": message}, status)


def read_json_body(handler) -> dict:
    try:
        length = int(handler.headers.get("Content-Length", 0))
        if length > MAX_BODY_BYTES:
            raise ValueError(f"Request body exceeds {MAX_BODY_BYTES} bytes.")
        raw = handler.rfile.read(length) if length > 0 else b""
        return json.loads(raw) if raw else {}
    except Exception:
        return {}


def get_auth_secret() -> str:
    secret = os.getenv("AUTH_SECRET")
    is_production = os.getenv("VERCEL_ENV") == "production" or os.getenv("NODE_ENV") == "production"
    if secret:
        return secret
    if is_production:
        raise RuntimeError("AUTH_SECRET must be configured in production.")
    return "local-development-secret-change-me"


def create_token(username: str, role: str) -> str:
    payload = f"{username}:{role}:{int(time.time())}"
    sig = hmac.new(get_auth_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def verify_token(token: str) -> dict | None:
    try:
        parts = token.split(":")
        if len(parts) != 4:
            return None
        username, role, ts, sig = parts
        payload = f"{username}:{role}:{ts}"
        expected = hmac.new(get_auth_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        if int(time.time()) - int(ts) > TOKEN_TTL_SECONDS:
            return None
        return {"username": username, "role": role}
    except Exception:
        return None


def require_auth(handler) -> dict | None:
    header = handler.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        send_error(handler, "Authentication required.", 401)
        return None
    user = verify_token(token.strip())
    if not user:
        send_error(handler, "Invalid or expired token.", 401)
        return None
    return user


# ---------------------------------------------------------------------------
# DataFrame serialisation helpers
# ---------------------------------------------------------------------------

def df_from_csv_b64(csv_b64: str):
    """Decode a base64-encoded CSV string and return a DataFrame."""
    import pandas as pd

    try:
        csv_bytes = base64.b64decode(csv_b64.encode("utf-8"), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("CSV payload is not valid base64.") from exc

    if len(csv_bytes) > MAX_CSV_BYTES:
        raise ValueError(f"CSV exceeds the {MAX_CSV_BYTES // (1024 * 1024)} MB upload limit.")

    df = pd.read_csv(io.BytesIO(csv_bytes))
    rows, cols = df.shape
    if rows > MAX_CSV_ROWS:
        raise ValueError(f"CSV has {rows} rows; the limit is {MAX_CSV_ROWS}.")
    if cols > MAX_CSV_COLUMNS:
        raise ValueError(f"CSV has {cols} columns; the limit is {MAX_CSV_COLUMNS}.")
    return df


def df_to_csv_b64(df) -> str:
    """Encode a DataFrame as a base64 CSV string."""
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def df_to_records(df) -> list[dict]:
    """Safely serialise a DataFrame or Series to a JSON-compatible list."""
    import pandas as pd

    if isinstance(df, pd.DataFrame):
        return json.loads(df.to_json(orient="records", date_format="iso"))
    if isinstance(df, pd.Series):
        return json.loads(
            df.reset_index().to_json(orient="records", date_format="iso")
        )
    return []


def fig_to_json(fig) -> dict | None:
    """Serialise a Plotly figure to a JSON-compatible dict."""
    if fig is None:
        return None
    try:
        return json.loads(fig.to_json())
    except Exception:
        return None


def _json_default(obj):
    """Custom serialiser for numpy / pandas types."""
    import numpy as np
    import pandas as pd

    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, pd.DataFrame):
        return json.loads(obj.to_json(orient="records", date_format="iso"))
    if isinstance(obj, pd.Series):
        return json.loads(
            obj.reset_index().to_json(orient="records", date_format="iso")
        )
    if hasattr(obj, "isoformat"):
        return obj.isoformat()
    return str(obj)
