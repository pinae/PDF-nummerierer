"""Oversized requests are refused from the Content-Length header, before Django
reads (and spools to disk) a single byte of the body."""

import pytest

from pdfnum.middleware import RequestSizeLimitMiddleware


def test_oversized_request_is_refused_before_reading_the_body(rf, settings):
    settings.PDFNUM_MAX_UPLOAD_BYTES = 1000
    request = rf.post("/api/documents/", data=b"", content_type="application/pdf")
    request.META["CONTENT_LENGTH"] = str(1000 + RequestSizeLimitMiddleware.OVERHEAD + 1)

    def view(request):  # pragma: no cover - must not be reached
        raise AssertionError("body was read")

    response = RequestSizeLimitMiddleware(view)(request)

    assert response.status_code == 413
    assert response["Content-Type"] == "application/json"


@pytest.mark.parametrize("length", ["", "100", "garbage"])
def test_normal_requests_pass(rf, settings, length):
    settings.PDFNUM_MAX_UPLOAD_BYTES = 1000
    request = rf.get("/")
    request.META["CONTENT_LENGTH"] = length

    response = RequestSizeLimitMiddleware(lambda r: "passed")(request)

    assert response == "passed"
