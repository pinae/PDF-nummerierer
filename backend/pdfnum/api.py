"""Shared API plumbing: CSRF for anonymous users, error format, throttling."""

from django.conf import settings
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.authentication import BaseAuthentication, CSRFCheck
from rest_framework.exceptions import APIException, ErrorDetail, NotFound, PermissionDenied
from rest_framework.throttling import AnonRateThrottle


class ApiError(APIException):
    """An error with a stable machine-readable code for the frontend."""

    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        super().__init__(detail=message, code=code)


class CsrfFailed(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "csrf_failed"
    default_detail = "The request was rejected (CSRF check failed). Reload the page."


class CsrfEnforcingAnonymousAuthentication(BaseAuthentication):
    """Authenticates nobody, but runs Django's CSRF check on every request.

    DRF exempts API views from CsrfViewMiddleware and only re-checks CSRF in
    SessionAuthentication for logged-in users. Without logins that would leave
    every mutating endpoint unprotected, so the check is enforced here.
    """

    def authenticate(self, request):
        check = CSRFCheck(lambda request: None)
        check.process_request(request)
        if check.process_view(request, None, (), {}) is not None:
            raise CsrfFailed()
        return None


class UploadRateThrottle(AnonRateThrottle):
    scope = "upload"

    def get_rate(self) -> str:
        return settings.PDFNUM_UPLOAD_RATE


def exception_handler(exc, context):
    """Render every API error as {"error": {"code": ..., "message": ...}}."""
    # Imported here: rest_framework.views imports this module via the settings.
    from rest_framework.views import exception_handler as drf_exception_handler

    if isinstance(exc, Http404):
        exc = NotFound("Not found. The file may have been deleted already.")
    elif isinstance(exc, DjangoPermissionDenied):
        exc = PermissionDenied()
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    detail = getattr(exc, "detail", None)
    if isinstance(detail, ErrorDetail):
        code, message = detail.code, str(detail)
    else:
        code = getattr(exc, "default_code", "error")
        message = str(getattr(exc, "default_detail", "The request could not be processed."))
    response.data = {"error": {"code": code, "message": message}}
    return response
