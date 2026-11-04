from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET


@require_GET
def health(request):
    return JsonResponse({"status": "ok"})


@require_GET
@ensure_csrf_cookie
def csrf(request):
    """Sets the csrftoken cookie the SPA echoes in the X-CSRFToken header."""
    return JsonResponse({"status": "ok"})


@require_GET
def limits(request):
    """Limits the UI states up front (upload size, retention, copies)."""
    return JsonResponse(
        {
            "max_upload_bytes": settings.PDFNUM_MAX_UPLOAD_BYTES,
            "retention_seconds": settings.PDFNUM_RETENTION_SECONDS,
            "max_copies": settings.PDFNUM_MAX_COPIES,
            "max_output_pages": settings.PDFNUM_MAX_OUTPUT_PAGES,
        }
    )
