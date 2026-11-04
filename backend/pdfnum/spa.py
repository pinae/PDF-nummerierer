"""Serving the app shell (index.html) of the built frontend in production."""

from pathlib import Path

from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.http import require_safe

from .frontend_headers import CONTENT_SECURITY_POLICY


@require_safe
def app_shell(request):
    """index.html for every non-API path, so client-side routes survive a reload."""
    index = Path(settings.PDFNUM_FRONTEND_DIR) / "index.html"
    if not index.is_file():
        return HttpResponse(
            "The frontend is not built. Run `make build` (or use the Docker image).",
            status=503,
            content_type="text/plain; charset=utf-8",
        )
    response = HttpResponse(index.read_bytes(), content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-cache"
    response["Content-Security-Policy"] = CONTENT_SECURITY_POLICY
    return response
