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

from api.analyze import handler as AnalyzeHandler
from api.auth import handler as AuthHandler
from api.datasets import handler as DatasetsHandler
from api.forecast import handler as ForecastHandler
from api.report import handler as ReportHandler
from api.upload import handler as UploadHandler
from api._utils import send_error


ROUTES = {
    "/api/analyze": AnalyzeHandler,
    "/api/auth": AuthHandler,
    "/api/datasets": DatasetsHandler,
    "/api/forecast": ForecastHandler,
    "/api/report": ReportHandler,
    "/api/upload": UploadHandler,
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


class NotFoundHandler(DispatchHandler):
    def do_GET(self):
        send_error(self, "Not found.", 404)

    def do_POST(self):
        send_error(self, "Not found.", 404)

    def do_OPTIONS(self):
        send_error(self, "Not found.", 404)


if __name__ == "__main__":
    server = HTTPServer(("localhost", 8000), DispatchHandler)
    print("Local Python API listening on http://localhost:8000")
    server.serve_forever()
