from django.conf import settings
from django.http import JsonResponse


class RequestSizeLimitMiddleware:
    """Refuse oversized requests from the Content-Length header alone.

    Runs before anything touches request.POST/FILES (including the CSRF check),
    so an oversized upload is never read or spooled to disk.
    """

    OVERHEAD = 1024 * 1024  # multipart framing and form fields besides the file

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            length = int(request.META.get("CONTENT_LENGTH") or 0)
        except ValueError:
            length = 0
        if length > settings.PDFNUM_MAX_UPLOAD_BYTES + self.OVERHEAD:
            return JsonResponse(
                {"error": {"code": "too_large", "message": too_large_message()}}, status=413
            )
        return self.get_response(request)


def too_large_message() -> str:
    megabytes = settings.PDFNUM_MAX_UPLOAD_BYTES / (1024 * 1024)
    return f"The file is too large. The maximum is {megabytes:g} MB."
