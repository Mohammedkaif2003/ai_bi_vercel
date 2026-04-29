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
import pandas as pd

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


from supabase_client import get_supabase_for_user  # noqa: E402
import uuid  # noqa: E402

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self)

    def do_POST(self):
        user = require_auth(self)
        if user is None:
            return

        data = read_json_body(self)
        csv_b64 = data.get("csv_b64", "")
        storage_path = data.get("storage_path")
        filename = str(data.get("filename", "upload.csv"))

        if not csv_b64 and not storage_path:
            send_error(self, "Either csv_b64 or storage_path is required.", 400)
            return

        try:
            if storage_path:
                # 1. Download from Supabase Storage (Bypasses Vercel payload limit)
                from supabase_client import get_supabase_for_user
                import base64
                supabase = get_supabase_for_user(user.get("token"))
                if not supabase:
                    raise ValueError("Could not connect to Supabase.")
                
                content = supabase.storage.from_("user_datasets").download(storage_path)
                csv_b64 = base64.b64encode(content).decode("utf-8")

            df = df_from_csv_b64(csv_b64)
        except Exception as exc:
            send_error(self, f"Could not load/parse CSV: {exc}", 422)
            return

        try:
            df = normalize_columns(df)
            schema = analyze_dataset(df)
            kpis = generate_kpis(df)
            insights = generate_auto_insights(df)
            normalised_csv_b64 = df_to_csv_b64(df)
            
            # 1. Generate a unique key and store in Redis for high-speed chat access
            dataset_id = str(uuid.uuid4())
            from redis_client import store_dataset
            store_dataset(dataset_id, normalised_csv_b64, ttl=3600) # 1 hour TTL
            
        except Exception as exc:
            send_error(self, f"Processing error: {exc}", 500)
            return
            
        # 2. Persistent Storage (Supabase) - used for reloading sessions later
        final_storage_path = storage_path # fallback to original if re-upload fails
        try:
            supabase = get_supabase_for_user(user.get("token"))
            if supabase and user.get("id") != "demo-user-id":
                user_id = user.get("id")
                import base64
                csv_bytes = base64.b64decode(normalised_csv_b64.encode("utf-8"))
                final_storage_path = f"{user_id}/{dataset_id}_{filename}"
                
                # We always re-upload the NORMALISED version for persistence
                supabase.storage.from_("user_datasets").upload(
                    path=final_storage_path,
                    file=csv_bytes,
                    file_options={"content-type": "text/csv"}
                )
        except Exception as exc:
            print(f"Failed to save to Supabase storage: {exc}")
            # If we already have a storage_path from the frontend, we are still okay
            if not final_storage_path:
                print("No storage path available for database entry.")

        try:
            if supabase and user.get("id") != "demo-user-id" and final_storage_path:
                supabase.table("datasets").insert({
                    "id": dataset_id,
                    "user_id": user.get("id"),
                    "filename": filename,
                    "storage_path": final_storage_path,
                    "row_count": df.shape[0],
                    "column_count": df.shape[1]
                }).execute()
        except Exception as exc:
            print(f"Failed to save to Supabase table: {exc}")

        # Calculate Data Health Score
        total_cells = df.size
        missing_cells = df.isnull().sum().sum()
        health_score = int(((total_cells - missing_cells) / total_cells) * 100) if total_cells > 0 else 100

        # Calculate Correlation Matrix (for numeric columns)
        correlations = {}
        import pandas as pd
        numeric_df = df.select_dtypes(include=['number'])
        if not numeric_df.empty and len(numeric_df.columns) > 1:
            corr_matrix = numeric_df.corr().round(2)
            correlations = {
                "columns": list(corr_matrix.columns),
                "values": corr_matrix.values.tolist()
            }

        send_json(self, {
            "dataset_key": dataset_id,
            "schema":      schema,
            "kpis":        kpis,
            "insights":    insights,
            "health_score": health_score,
            "correlations": correlations,
            "preview_rows": df_to_records(df.head(20)),
            "filename":    filename,
            "shape":       list(df.shape),
        })

    def log_message(self, format, *args):
        pass
