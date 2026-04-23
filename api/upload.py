"""CSV upload endpoint — POST /api/upload

Accepts a JSON body with a base64-encoded CSV:
    { "csv_b64": "<base64>", "filename": "my_data.csv" }

Returns:
    {
        "csv_b64":  "<base64>",      # normalised DataFrame as CSV
        "schema":   { ... },          # from dataset_analyzer
        "kpis":     [ ... ],          # from kpi_engine
        "insights": [ ... ],          # from auto_insights
        "filename": "my_data.csv",
        "shape":    [rows, cols]
    }
"""
from __future__ import annotations

import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _utils import (  # noqa: E402
    df_from_csv_b64,
    df_to_csv_b64,
    handle_options,
    read_json_body,
    require_auth,
    send_error,
    send_json,
    df_to_records,
)
from modules.auto_insights import generate_auto_insights  # noqa: E402
from modules.data_loader import normalize_columns  # noqa: E402
from modules.dataset_analyzer import analyze_dataset  # noqa: E402
from modules.kpi_engine import generate_kpis  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self)

    def do_POST(self):
        if require_auth(self) is None:
            return

        data = read_json_body(self)
        csv_b64 = data.get("csv_b64", "")
        filename = str(data.get("filename", "upload.csv"))

        if not csv_b64:
            send_error(self, "csv_b64 is required.", 400)
            return

        try:
            df = df_from_csv_b64(csv_b64)
        except Exception as exc:
            send_error(self, f"Could not parse CSV: {exc}", 422)
            return

        try:
            df = normalize_columns(df)
            schema = analyze_dataset(df)
            kpis = generate_kpis(df)
            insights = generate_auto_insights(df)
            normalised_csv_b64 = df_to_csv_b64(df)
        except Exception as exc:
            send_error(self, f"Processing error: {exc}", 500)
            return

        send_json(self, {
            "csv_b64":  normalised_csv_b64,
            "schema":   schema,
            "kpis":     kpis,
            "insights": insights,
            "preview_rows": df_to_records(df.head(20)),
            "filename": filename,
            "shape":    list(df.shape),
        })

    def log_message(self, format, *args):
        pass
