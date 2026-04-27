"""PDF report endpoint — POST /api/report

Request body:
    {
        "analysis_history": [
            {
                "query":       "Which region has the highest revenue?",
                "ai_response": "The North region leads with ...",
                "insight":     "...",
                "result":      [ ... ]        // table rows (no charts — serverless)
            },
            ...
        ],
        "dataset_name": "sales_data.csv",   // optional
        "user_name":    "Administrator"      // optional
    }

Response (200):
    { "pdf_b64": "<base64-encoded PDF bytes>" }

Note: chart images are not embedded in the serverless PDF because
kaleido (Chromium-based) is not available in the Vercel Python runtime.
Prose text, tables, and cover page are fully supported.
"""
from __future__ import annotations

import base64
import os
import sys
import tempfile
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _utils import handle_options, read_json_body, require_auth, send_error, send_json  # noqa: E402
from modules.report_generator import generate_pdf  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self)

    def do_POST(self):
        if require_auth(self) is None:
            return

        data = read_json_body(self)
        analysis_history = data.get("analysis_history") or []
        dataset_name = data.get("dataset_name") or "Active Dataset"
        user_name = data.get("user_name") or "Nexlytics User"
        report_title = data.get("report_title") or "AI-Assisted Executive Briefing"
        report_intro = data.get("report_intro") or ""

        if not isinstance(analysis_history, list):
            send_error(self, "analysis_history must be a list.", 400)
            return

        # Write the PDF to /tmp (only writable location in Vercel)
        tmp_path = os.path.join(tempfile.gettempdir(), "nexlytics_report.pdf")

        try:
            generate_pdf(
                analysis_history=analysis_history,
                dataset_name=dataset_name,
                user_name=user_name,
                file_path=tmp_path,
                report_title=report_title,
                report_intro=report_intro
            )
        except Exception as exc:
            send_error(self, f"PDF generation failed: {exc}", 500)
            return

        try:
            with open(tmp_path, "rb") as f:
                pdf_bytes = f.read()
            pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
        except Exception as exc:
            send_error(self, f"Could not read generated PDF: {exc}", 500)
            return
        finally:
            # Clean up temp file
            try:
                os.remove(tmp_path)
            except OSError:
                pass

        send_json(self, {"pdf_b64": pdf_b64})

    def log_message(self, format, *args):
        pass
