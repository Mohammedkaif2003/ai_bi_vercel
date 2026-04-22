"""Forecasting endpoint — POST /api/forecast

Request body:
    { "csv_b64": "<base64 CSV>", "periods": 6 }

Response (200):
    {
        "available":    true,
        "message":      "Forecast generated for next 6 months.",
        "metric":       "Revenue",
        "trend":        "increasing",
        "slope":        1234.56,
        "forecast":     [ { "Date": "...", "Predicted": ..., "Lower Bound": ..., "Upper Bound": ... } ],
        "historical":   [ { "Date": "...", "Revenue": ... } ],
        "chart":        { <Plotly JSON> } | null
    }
"""
from __future__ import annotations

import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import plotly.express as px  # noqa: E402

from _utils import (  # noqa: E402
    df_from_csv_b64,
    df_to_records,
    fig_to_json,
    handle_options,
    read_json_body,
    send_error,
    send_json,
)
from modules.data_loader import normalize_columns  # noqa: E402
from modules.forecasting import forecast_revenue  # noqa: E402

_PRIMARY = "#4F46E5"
_TERTIARY = "#F59E0B"


def _build_forecast_chart(historical_df, forecast_df, metric: str) -> dict | None:
    """Combine historical + forecast data into a Plotly chart spec."""
    try:
        import pandas as pd

        hist = historical_df.copy()
        hist["Type"] = "Historical"
        hist.rename(columns={metric: "Value"}, inplace=True)

        fc = forecast_df[["Date", "Predicted"]].copy()
        fc.rename(columns={"Predicted": "Value"}, inplace=True)
        fc["Type"] = "Forecast"

        combined = pd.concat([hist, fc], ignore_index=True)
        combined["Date"] = pd.to_datetime(combined["Date"], errors="coerce")

        fig = px.line(
            combined,
            x="Date",
            y="Value",
            color="Type",
            color_discrete_map={"Historical": _PRIMARY, "Forecast": _TERTIARY},
            markers=True,
            title=f"{metric} — Historical & Forecast",
        )
        fig.update_traces(line=dict(width=3), marker=dict(size=7))
        fig.update_layout(
            template="plotly_white",
            height=420,
            font=dict(family="Manrope, Segoe UI, sans-serif", size=12),
            margin=dict(l=60, r=30, t=60, b=60),
        )
        return fig_to_json(fig)
    except Exception:
        return None


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self)

    def do_POST(self):
        data = read_json_body(self)
        csv_b64 = data.get("csv_b64", "")
        try:
            periods = int(data.get("periods", 6))
        except (TypeError, ValueError):
            periods = 6
        periods = max(1, min(periods, 24))

        if not csv_b64:
            send_error(self, "csv_b64 is required.", 400)
            return

        try:
            df = df_from_csv_b64(csv_b64)
            df = normalize_columns(df)
        except Exception as exc:
            send_error(self, f"Could not load dataset: {exc}", 422)
            return

        result = forecast_revenue(df, periods=periods)

        if not result.get("available"):
            send_json(self, {
                "available": False,
                "message": result.get("message", "Forecasting not available."),
                "forecast": [],
                "historical": [],
                "chart": None,
            })
            return

        forecast_df = result.get("forecast_df")
        historical_df = result.get("historical_df")
        metric = result.get("metric", "Value")

        chart = _build_forecast_chart(historical_df, forecast_df, metric)

        send_json(self, {
            "available":  True,
            "message":    result.get("message", ""),
            "metric":     metric,
            "trend":      result.get("trend", ""),
            "slope":      result.get("slope", 0),
            "std_error":  result.get("std_error", 0),
            "forecast":   df_to_records(forecast_df),
            "historical": df_to_records(historical_df),
            "chart":      chart,
        })

    def log_message(self, format, *args):
        pass
