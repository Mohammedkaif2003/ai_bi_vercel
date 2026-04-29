"""Run the Vercel-style Python API handlers locally.

Next.js dev does not serve the root-level ``api/*.py`` serverless functions,
so this small dispatcher lets the frontend call them through
NEXT_PUBLIC_API_BASE=http://localhost:8000.
"""
from __future__ import annotations

import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Load environment variables from .env or .env.local
try:
    from dotenv import load_dotenv
    # Load .env first (base)
    base_env = os.path.join(ROOT, ".env")
    if os.path.exists(base_env):
        load_dotenv(base_env)
    
    # Then load .env.local (overrides)
    local_env = os.path.join(ROOT, ".env.local")
    if os.path.exists(local_env):
        load_dotenv(local_env, override=True)
except ImportError:
    pass # If python-dotenv is not installed, assume env vars are set manually

from api.analyze import handler as AnalyzeHandler
from api.datasets import handler as DatasetsHandler
from api.forecast import handler as ForecastHandler
from api.report import handler as ReportHandler
from api.upload import handler as UploadHandler
from api.search import handler as SearchHandler
from api._utils import send_error


ROUTES = {
    "/api/analyze": AnalyzeHandler,
    "/api/datasets": DatasetsHandler,
    "/api/forecast": ForecastHandler,
    "/api/report": ReportHandler,
    "/api/upload": UploadHandler,
    "/api/search": SearchHandler,
}


class DispatchHandler(BaseHTTPRequestHandler):
    def _route(self):
        path = urlparse(self.path).path
        return ROUTES.get(path)

    def do_GET(self):
        handler_cls = self._route()
        if handler_cls and hasattr(handler_cls, "do_GET"):
            return handler_cls.do_GET(self)
        send_error(self, "Not found.", 404)

    def do_POST(self):
        handler_cls = self._route()
        if handler_cls and hasattr(handler_cls, "do_POST"):
            return handler_cls.do_POST(self)
        send_error(self, "Not found.", 404)

    def do_OPTIONS(self):
        handler_cls = self._route()
        if handler_cls and hasattr(handler_cls, "do_OPTIONS"):
            return handler_cls.do_OPTIONS(self)
        send_error(self, "Not found.", 404)

    def log_message(self, format, *args):
        pass

    def address_string(self):
        return self.client_address[0]


class NotFoundHandler(DispatchHandler):
    def do_GET(self):
        send_error(self, "Not found.", 404)

    def do_POST(self):
        send_error(self, "Not found.", 404)

    def do_OPTIONS(self):
        send_error(self, "Not found.", 404)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    server = HTTPServer(("127.0.0.1", port), DispatchHandler)
    print(f"Local Python API listening on http://127.0.0.1:{port}")
    server.serve_forever()
