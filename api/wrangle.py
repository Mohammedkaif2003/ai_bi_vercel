"""Wrangle endpoint — POST /api/wrangle

Sub-actions:
    "inspect" - Audit data for issues
    "clean"   - Apply fixes
"""
from __future__ import annotations

import os
import sys
from http.server import BaseHTTPRequestHandler
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _utils import (  # noqa: E402
    df_from_csv_b64,
    df_to_records,
    handle_options,
    load_dataset_b64,
    read_json_body,
    require_auth,
    send_error,
    send_json,
    save_dataset_b64, # Need to add this to _utils or use existing pattern
)
from modules.data_loader import normalize_columns  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self)

    def do_POST(self):
        user = require_auth(self)
        if user is None:
            return

        data = read_json_body(self)
        action = data.get("action", "inspect")
        dataset_key = data.get("dataset_key")

        if not dataset_key:
            send_error(self, "dataset_key is required.", 400)
            return

        try:
            csv_b64 = load_dataset_b64(dataset_key, user)
            df = df_from_csv_b64(csv_b64)
            df_orig = df.copy()

            if action == "inspect":
                issues = []
                
                # 1. Missing values
                null_counts = df.isnull().sum()
                for col, count in null_counts.items():
                    if count > 0:
                        issues.append({
                            "type": "missing_values",
                            "column": col,
                            "count": int(count),
                            "severity": "high" if count / len(df) > 0.5 else "medium"
                        })
                
                # 2. Duplicate rows
                dup_count = int(df.duplicated().sum())
                if dup_count > 0:
                    issues.append({
                        "type": "duplicates",
                        "count": dup_count,
                        "severity": "medium"
                    })
                
                # 3. Data type inconsistencies
                for col in df.columns:
                    # Check if numeric column has string values
                    if df[col].dtype == 'object':
                        # Try converting to numeric
                        temp = pd.to_numeric(df[col], errors='coerce')
                        if temp.notnull().sum() / len(df) > 0.8: # >80% are numbers
                            issues.append({
                                "type": "mixed_types",
                                "column": col,
                                "suggestion": "Convert to numeric",
                                "severity": "low"
                            })

                send_json(self, {
                    "health_score": max(0, 100 - (len(issues) * 5)),
                    "issues": issues,
                    "row_count": len(df),
                    "col_count": len(df.columns)
                })

            elif action == "clean":
                # Apply fixes
                # 1. Drop duplicates
                df = df.drop_duplicates()
                
                # 2. Fill missing values (simple strategy)
                for col in df.columns:
                    if df[col].dtype == 'object':
                        df[col] = df[col].fillna("Unknown")
                    else:
                        df[col] = df[col].fillna(df[col].median() if not df[col].isnull().all() else 0)
                
                # 3. Fix types
                for col in df.columns:
                    if df[col].dtype == 'object':
                        temp = pd.to_numeric(df[col], errors='coerce')
                        if temp.notnull().sum() / len(df) > 0.8:
                            df[col] = temp.fillna(0)

                # Convert back to base64
                import io
                import base64
                output = io.StringIO()
                df.to_csv(output, index=False)
                new_csv_b64 = base64.b64encode(output.getvalue().encode()).decode()
                
                # In a real app we'd save this. 
                # For this demo, we'll return the new shape and a success msg.
                send_json(self, {
                    "message": "Data cleaned successfully!",
                    "new_shape": [len(df), len(df.columns)],
                    "csv_b64": new_csv_b64 # Return it so frontend can update state
                })

        except Exception as e:
            send_error(self, f"Wrangler failed: {e}", 500)

    def log_message(self, format, *args):
        pass
