"""Shared utilities for Vercel Python serverless functions.

All handler modules import from this file.  It also ensures the project
root is on sys.path so that ``from modules.xxx import yyy`` resolves
correctly inside each serverless function.
"""
from __future__ import annotations

import base64
import io
import json
import os
import sys

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

def _add_cors_headers(handler) -> None:
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
        raw = handler.rfile.read(length) if length > 0 else b""
        return json.loads(raw) if raw else {}
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# DataFrame serialisation helpers
# ---------------------------------------------------------------------------

def df_from_csv_b64(csv_b64: str):
    """Decode a base64-encoded CSV string and return a DataFrame."""
    import pandas as pd

    csv_bytes = base64.b64decode(csv_b64.encode("utf-8"))
    return pd.read_csv(io.BytesIO(csv_bytes))


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
