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

from _utils import handle_options, read_json_body, require_auth, send_error, send_json, log_audit, load_dataset_b64, df_from_csv_b64  # noqa: E402
from modules.report_intelligence import extract_global_kpis, deduplicate_and_synthesize, generate_section_titles  # noqa: E402
from modules.report_generator import generate_pdf  # noqa: E402

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self)

    def do_POST(self):
        user = require_auth(self)
        if user is None:
            return

        data = read_json_body(self)
        analysis_history = data.get("analysis_history") or []
        dataset_name = data.get("dataset_name") or "Active Dataset"
        dataset_key = data.get("dataset_key")
        
        log_audit(user, "report_gen", {"dataset_name": dataset_name, "n_analyses": len(analysis_history)})
        user_name = data.get("user_name") or "Nexlytics User"
        report_title = data.get("report_title") or "AI-Assisted Executive Briefing"
        report_intro = data.get("report_intro") or ""

        if not isinstance(analysis_history, list):
            send_error(self, "analysis_history must be a list.", 400)
            return

        # --- Intelligence Layer ---
        kpis = []
        if dataset_key:
            try:
                csv_b64 = load_dataset_b64(dataset_key, user)
                df = df_from_csv_b64(csv_b64)
                kpis = extract_global_kpis(df)
            except Exception as e:
                print(f"[KPI Extraction Warning]: {e}")

        intel = deduplicate_and_synthesize(analysis_history)
        clean_history = intel["clean_history"]
        exec_summary = intel["executive_summary"]
        strat_conclusion = intel["strategic_conclusion"]
        
        # Override intro if we generated a better one and user didn't provide a custom one
        if not report_intro:
            report_intro = exec_summary
            
        dynamic_titles = generate_section_titles(clean_history)
        for i, entry in enumerate(clean_history):
            entry["dynamic_title"] = dynamic_titles[i]

        # Write the PDF to /tmp with a unique name to avoid concurrency issues
        import uuid
        tmp_filename = f"report_{uuid.uuid4().hex}.pdf"
        tmp_path = os.path.join(tempfile.gettempdir(), tmp_filename)

        brand_logo_b64 = data.get("brand_logo_b64")
        brand_color = data.get("brand_color") or "#6366F1"
        theme = data.get("theme") or "light"

        try:
            generate_pdf(
                analysis_history=clean_history,
                dataset_name=dataset_name,
                user_name=user_name,
                file_path=tmp_path,
                report_title=report_title,
                report_intro=report_intro,
                brand_logo_b64=brand_logo_b64,
                brand_color=brand_color,
                theme=theme,
                kpis=kpis,
                strategic_conclusion=strat_conclusion
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
