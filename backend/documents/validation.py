"""Checks an upload must pass before it is stored."""

from django.core.files.uploadedfile import UploadedFile
from rest_framework import status

from pdfnum.api import ApiError
from pdfnum.middleware import too_large_message
from stamping import EncryptedPdfError, InvalidPdfError, PageGeometry, inspect_pdf

HEADER_SEARCH_BYTES = 1024  # the PDF header may follow a few bytes of garbage
MAX_NAME_LENGTH = 200


def validate_pdf(upload: UploadedFile, max_bytes: int) -> list[PageGeometry]:
    """Return the page geometry of a valid PDF or raise ApiError."""
    if upload.size > max_bytes:
        raise ApiError(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "too_large", too_large_message())

    upload.seek(0)
    head = upload.read(HEADER_SEARCH_BYTES)
    upload.seek(0)
    if b"%PDF-" not in head:
        raise ApiError(status.HTTP_400_BAD_REQUEST, "not_pdf", "This file is not a PDF.")

    try:
        pages = inspect_pdf(upload)
    except EncryptedPdfError:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "encrypted_pdf",
            "This PDF is password protected. Please upload a version without a password.",
        ) from None
    except InvalidPdfError:
        pages = []
    finally:
        upload.seek(0)
    if not pages:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "invalid_pdf",
            "This PDF is damaged or empty and cannot be read.",
        )
    return pages


def display_name(raw: str | None) -> str:
    """The uploaded file name, for display only (never used on disk)."""
    name = (raw or "").replace("\\", "/").rsplit("/", 1)[-1]
    name = "".join(char for char in name if char.isprintable()).strip()
    return name[:MAX_NAME_LENGTH] or "document.pdf"
