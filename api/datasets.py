"""Datasets endpoint

GET  /api/datasets
    Returns a list of bundled sample datasets.
    Response: { "datasets": [ { "key": "sales_data.csv", "label": "Sales Data" }, ... ] }

POST /api/datasets
    Body: { "dataset_key": "sales_data.csv" }
    Loads a bundled dataset, normalises it, and returns the full payload.
    Response: same shape as /api/upload
"""
from __future__ import annotations

import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _utils import (  # noqa: E402
    df_to_csv_b64,
    handle_options,
    read_json_body,
    send_error,
    send_json,
)
from modules.auto_insights import generate_auto_insights  # noqa: E402
from modules.data_loader import normalize_columns  # noqa: E402
from modules.dataset_analyzer import analyze_dataset  # noqa: E402
from modules.kpi_engine import generate_kpis  # noqa: E402

# ---------------------------------------------------------------------------
# Bundled datasets (mirror config.FRIENDLY_DATASET_NAMES)
# ---------------------------------------------------------------------------

_DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "raw",
)

_FRIENDLY: dict[str, str] = {
    "sales_data.csv":   "Sales Data (5,000 records)",
    "hr_data.csv":      "HR Data (500 records)",
    "finance_data.csv": "Finance Data (56 records)",
}


def _list_datasets() -> list[dict]:
    if not os.path.isdir(_DATA_DIR):
        return []
    result = []
    for fname in sorted(os.listdir(_DATA_DIR)):
        if fname.endswith(".csv"):
            result.append({
                "key":   fname,
                "label": _FRIENDLY.get(fname, fname),
            })
    return result


def _load_dataset(dataset_key: str) -> dict:
    """Load, normalise and package a bundled dataset."""
    import pandas as pd

    safe_key = os.path.basename(dataset_key)
    path = os.path.join(_DATA_DIR, safe_key)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Dataset not found: {safe_key}")

    try:
        df = pd.read_csv(path, encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(path, encoding="latin-1")

    df = normalize_columns(df)
    schema = analyze_dataset(df)
    kpis = generate_kpis(df)
    insights = generate_auto_insights(df)
    csv_b64 = df_to_csv_b64(df)

    return {
        "csv_b64":  csv_b64,
        "schema":   schema,
        "kpis":     kpis,
        "insights": insights,
        "filename": safe_key,
        "shape":    list(df.shape),
    }


# ---------------------------------------------------------------------------
# Vercel handler
# ---------------------------------------------------------------------------

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self)

    def do_GET(self):
        send_json(self, {"datasets": _list_datasets()})

    def do_POST(self):
        data = read_json_body(self)
        dataset_key = str(data.get("dataset_key", "")).strip()

        if not dataset_key:
            send_error(self, "dataset_key is required.", 400)
            return

        try:
            payload = _load_dataset(dataset_key)
        except FileNotFoundError as exc:
            send_error(self, str(exc), 404)
            return
        except Exception as exc:
            send_error(self, f"Failed to load dataset: {exc}", 500)
            return

        send_json(self, payload)

    def log_message(self, format, *args):
        pass
