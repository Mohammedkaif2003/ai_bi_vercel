"""Full-dataset search endpoint — POST /api/search

Returns paginated records from the dataset. Filtering has been removed.
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
    df_to_records,
    handle_options,
    load_dataset_b64,
    read_json_body,
    require_auth,
    send_error,
    send_json,
)

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self)

    def do_POST(self):
        user = require_auth(self)
        if user is None:
            return

        data = read_json_body(self)
        dataset_key = data.get("dataset_key")
        page = int(data.get("page", 1))
        page_size = int(data.get("page_size", 20))

        if not dataset_key:
            send_error(self, "dataset_key is required.", 400)
            return

        try:
            csv_b64 = load_dataset_b64(dataset_key, user)
            df = df_from_csv_b64(csv_b64)

            full_results = df
            total_matches = len(full_results)
            
            # Apply pagination
            start_idx = (page - 1) * page_size
            end_idx = start_idx + page_size
            paginated_results = full_results.iloc[start_idx:end_idx]

            send_json(self, {
                "results": df_to_records(paginated_results),
                "total_matches": total_matches,
                "page": page,
                "page_size": page_size,
                "total_pages": (total_matches + page_size - 1) // page_size
            })

        except Exception as e:
            send_error(self, f"Data fetch failed: {e}", 500)

    def log_message(self, format, *args):
        pass
