"""Analysis endpoint — POST /api/analyze

Request body:
    {
        "query":        "Which region has the highest revenue?",
        "csv_b64":      "<base64 CSV>",
        "dataset_name": "sales_data.csv"   // optional, for narration context
    }

Response (200):
    {
        "query_type":   "ranking",
        "summary":      "Average Revenue grouped by Region ...",
        "narration":    "The North region leads with $1.2M ...",
        "result":       [ { "Region": "North", "Revenue": 123456 }, ... ],
        "chart":        { <Plotly JSON> } | null,
        "chart_type":   "bar" | null
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
    df_to_records,
    fig_to_json,
    handle_options,
    load_dataset_b64,
    log_audit,
    read_json_body,
    require_auth,
    send_error,
    send_json,
)
from modules.ai_conversation import narrate_result  # noqa: E402
from modules.data_loader import mask_sensitive_columns, normalize_columns  # noqa: E402
from modules.query_utils import is_dataset_related_query  # noqa: E402
from modules.smart_analysis import run_smart_analysis  # noqa: E402


def _safe_result(result) -> list[dict]:
    """Convert smart_analysis result value to a JSON-serialisable list."""
    import pandas as pd

    if isinstance(result, (pd.DataFrame, pd.Series)):
        return df_to_records(result)
    if result is None:
        return []
    # scalar
    return [{"value": result}]


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self)

    def do_POST(self):
        user = require_auth(self)
        if user is None:
            return

        data = read_json_body(self)
        query = str(data.get("query", "")).strip()
        dataset_key = data.get("dataset_key", "")
        dataset_name = str(data.get("dataset_name", ""))

        if not query:
            send_error(self, "query is required.", 400)
            return
        if not dataset_key:
            send_error(self, "dataset_key is required.", 400)
            return

        # Load dataset content robustly
        try:
            csv_b64 = load_dataset_b64(dataset_key, user)
        except ValueError as e:
            send_error(self, str(e), 404)
            return
        except Exception as e:
            send_error(self, f"Unexpected error loading dataset: {e}", 500)
            return

        try:
            df = df_from_csv_b64(csv_b64)
            df = normalize_columns(df)
            # Apply Column-Level Security
            df = mask_sensitive_columns(df, user.get("role", "viewer"))
        except Exception as exc:
            send_error(self, f"Could not load dataset: {exc}", 422)
            return

        # Relevance check
        if not is_dataset_related_query(query, df):
            send_json(self, {
                "query_type": "irrelevant",
                "summary": "",
                "narration": (
                    "That question doesn't appear to be about the current dataset. "
                    "Try asking about the columns or metrics in your data."
                ),
                "result": [],
                "chart": None,
                "chart_type": None,
            })
            return

        # Deterministic smart analysis
        log_audit(user, "analyze", {"query": query, "dataset_key": dataset_key})
        analysis = run_smart_analysis(query, df)
        if analysis is None:
            send_json(self, {
                "query_type": "unknown",
                "summary": "",
                "narration": (
                    "I couldn't compute a deterministic answer for this query. "
                    "Try rephrasing or asking about a specific column or metric."
                ),
                "result": [],
                "chart": None,
                "chart_type": None,
            })
            return

        summary = analysis.get("summary", "")
        query_type = analysis.get("query_type", "general")
        fig = analysis.get("chart")
        result = analysis.get("result")

        # Narrate pre-computed results with the LLM
        narration = narrate_result(query, summary) if summary else summary

        send_json(self, {
            "query_type": query_type,
            "summary":    summary,
            "narration":  narration,
            "result":     _safe_result(result),
            "chart":      fig_to_json(fig),
            "chart_type": query_type,
        })

    def log_message(self, format, *args):
        pass
