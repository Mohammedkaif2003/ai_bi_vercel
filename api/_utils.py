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
import functools
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


def log_audit(user, action: str, details: dict = None):
    """Silently log an action to the audit_logs table."""
    try:
        from supabase_client import get_supabase
        supabase = get_supabase()
        supabase.table("audit_logs").insert({
            "user_id": user.get("id"),
            "action": action,
            "details": details or {},
            "dataset_key": details.get("dataset_key") if details else None
        }).execute()
    except Exception as e:
        print(f"Audit Log Failed: {e}")


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


def verify_token(token: str) -> dict | None:
    """Securely verifies a Supabase JWT by calling the Supabase Auth server.
    This ensures the token is valid, signed, and not expired.
    """
    import logging
    logger = logging.getLogger("auth")

    if not token or token.count(".") != 2:
        return None

    from supabase_client import get_supabase
    try:
        # Initialize client with service role key for verification
        supabase = get_supabase()
        
        # Verify the token with Supabase Auth server
        response = supabase.auth.get_user(token)
        user = response.user
        
        if user:
            return {
                "username": user.email or "Supabase User",
                "role": "Pro Analyst",
                "id": user.id,
                "token": token
            }
        logger.warning("Supabase: No user found for token.")
    except Exception as e:
        logger.error(f"Supabase verification error: {e}")
        
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
# Dataset Loading Helpers
# ---------------------------------------------------------------------------

def load_dataset_b64(dataset_key: str, user: dict | None = None) -> str:
    """Robustly load a dataset as base64 from any source:
    1. Redis Cache
    2. Supabase Storage (if key starts with 'sb_' or is a valid UUID)
    3. Local Filesystem (bundled samples)
    """
    import io
    import re
    import pandas as pd
    from redis_client import get_dataset, store_dataset

    # 1. Try Redis Cache (High-speed)
    csv_b64 = get_dataset(dataset_key)
    if csv_b64:
        return csv_b64

    # 2. Try Supabase Storage (Cloud)
    # Check if it starts with 'sb_' OR is a raw UUID
    is_sb_prefixed = dataset_key.startswith("sb_")
    is_uuid = bool(re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", dataset_key, re.I))
    
    if (is_sb_prefixed or is_uuid) and user:
        dataset_id = dataset_key[3:] if is_sb_prefixed else dataset_key
        from supabase_client import get_supabase_for_user
        supabase = get_supabase_for_user(user.get("token"))
        if not supabase:
            raise ValueError("Could not connect to Supabase.")
        
        # Query the datasets table to find the storage path
        res = supabase.table("datasets").select("storage_path").eq("id", dataset_id).execute()
        if not res.data:
            # If we didn't find it and it wasn't prefixed, maybe it's actually a local file name
            if not is_sb_prefixed and not is_uuid:
                pass # fall through to local check
            else:
                raise ValueError(f"Cloud dataset not found: {dataset_id}")
        else:
            path = res.data[0]["storage_path"]
            content = supabase.storage.from_("user_datasets").download(path)
            csv_b64 = base64.b64encode(content).decode("utf-8")
            
            # Re-cache for next time
            store_dataset(dataset_key, csv_b64)
            return csv_b64

    # 3. Try Local Filesystem (Library Samples)
    # Use basename to prevent directory traversal
    safe_name = os.path.basename(dataset_key)
    local_path = os.path.join(_ROOT, "data", "raw", safe_name)
    if os.path.exists(local_path):
        try:
            df = pd.read_csv(local_path)
            csv_b64 = df_to_csv_b64(df)
            # Cache for next time
            store_dataset(dataset_key, csv_b64)
            return csv_b64
        except Exception as e:
            raise ValueError(f"Failed to load local dataset: {e}")

    raise ValueError(f"Dataset not found: {dataset_key}")


# ---------------------------------------------------------------------------
# DataFrame serialisation helpers
# ---------------------------------------------------------------------------

@functools.lru_cache(maxsize=4)
def _parse_csv_bytes(csv_bytes: bytes):
    """Internal cached parser for CSV bytes."""
    import pandas as pd
    return pd.read_csv(io.BytesIO(csv_bytes))


def df_from_csv_b64(csv_b64: str):
    """Decode a base64-encoded CSV string and return a DataFrame."""
    try:
        csv_bytes = base64.b64decode(csv_b64.encode("utf-8"), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("CSV payload is not valid base64.") from exc

    if len(csv_bytes) > MAX_CSV_BYTES:
        raise ValueError(f"CSV exceeds the {MAX_CSV_BYTES // (1024 * 1024)} MB upload limit.")

    # Use the cached parser to avoid re-reading the same bytes
    df = _parse_csv_bytes(csv_bytes)
    
    rows, cols = df.shape
    if rows > MAX_CSV_ROWS:
        raise ValueError(f"CSV has {rows} rows; the limit is {MAX_CSV_ROWS}.")
    if cols > MAX_CSV_COLUMNS:
        raise ValueError(f"CSV has {cols} columns; the limit is {MAX_CSV_COLUMNS}.")
    return df.copy() # Return a copy to prevent mutation of cached object


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
