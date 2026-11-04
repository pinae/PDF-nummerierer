import datetime as dt
from pathlib import Path

import pytest
from django.utils import timezone

from documents.models import Document
from stamping.tests.pdfs import PageSpec, make_pdf

pytestmark = pytest.mark.django_db


def stored_files(settings) -> list[Path]:
    root = Path(settings.MEDIA_ROOT)
    return sorted(p for p in root.rglob("*") if p.is_file()) if root.exists() else []


def error_code(response) -> str:
    return response.json()["error"]["code"]


def test_upload_returns_what_the_viewer_needs(client, upload, exam_pdf):
    response = upload(client, exam_pdf)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "exam.pdf"
    assert body["size"] == len(exam_pdf)
    assert body["page_count"] == 3
    assert body["page_sizes"] == [[595.28, 841.89]] * 3
    created = dt.datetime.fromisoformat(body["created_at"])
    expires = dt.datetime.fromisoformat(body["expires_at"])
    assert expires - created == dt.timedelta(hours=2)


def test_page_sizes_are_as_displayed(client, upload):
    pdf = make_pdf(PageSpec(size=(300, 200), rotate=90), PageSpec(size=(300, 200)))

    body = upload(client, pdf).json()

    assert body["page_sizes"] == [[200, 300], [300, 200]]


def test_file_is_stored_under_a_server_generated_name(client, upload, exam_pdf, settings):
    body = upload(client, exam_pdf, name="../../etc/passwd.pdf").json()

    (stored,) = stored_files(settings)
    assert stored == Path(settings.MEDIA_ROOT) / "documents" / f"{body['id']}.pdf"
    assert stored.read_bytes() == exam_pdf
    assert body["name"] == "passwd.pdf"


def test_upload_starts_a_new_session(client, upload, exam_pdf):
    """A session cookie planted before the upload must not lead to the exam."""
    client.get("/api/health/")
    session = client.session
    session["planted"] = True
    session.save()
    planted_key = session.session_key

    upload(client, exam_pdf)

    assert client.cookies["sessionid"].value != planted_key


def test_session_cookie_is_hardened(client, upload, exam_pdf):
    response = upload(client, exam_pdf)

    cookie = response.cookies["sessionid"]
    assert cookie["httponly"]
    assert cookie["secure"]
    assert cookie["samesite"] == "Lax"


def test_missing_file(client):
    response = client.post("/api/documents/", {})

    assert response.status_code == 400
    assert error_code(response) == "missing_file"


def test_too_large(client, upload, exam_pdf, settings):
    settings.PDFNUM_MAX_UPLOAD_BYTES = len(exam_pdf) - 1

    response = upload(client, exam_pdf)

    assert response.status_code == 413
    assert error_code(response) == "too_large"
    assert stored_files(settings) == []


def test_not_a_pdf(client, upload, settings):
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100

    response = upload(client, png, name="photo.pdf")

    assert response.status_code == 400
    assert error_code(response) == "not_pdf"
    assert stored_files(settings) == []


def test_pdf_header_after_leading_garbage_is_accepted(client, upload, exam_pdf):
    response = upload(client, b"\xef\xbb\xbf\n" + exam_pdf)

    assert response.status_code == 201


def test_corrupt_pdf(client, upload, settings):
    response = upload(client, b"%PDF-1.7\nthis is not really a PDF\n%%EOF")

    assert response.status_code == 400
    assert error_code(response) == "invalid_pdf"
    assert stored_files(settings) == []


def test_password_protected_pdf(client, upload):
    response = upload(client, make_pdf(PageSpec(text="secret"), password="s3cret"))

    assert response.status_code == 400
    assert error_code(response) == "encrypted_pdf"


def test_errors_carry_a_human_readable_message(client, upload):
    response = upload(client, b"plain text")

    assert "PDF" in response.json()["error"]["message"]


def test_uploads_are_throttled_per_client(client, upload, exam_pdf, settings):
    settings.PDFNUM_UPLOAD_RATE = "2/minute"

    statuses = [upload(client, exam_pdf).status_code for _ in range(3)]

    assert statuses == [201, 201, 429]
    assert error_code(upload(client, exam_pdf)) == "throttled"


def test_upload_purges_expired_documents_of_everybody(
    client, fresh_client, upload, exam_pdf, settings
):
    old = upload(fresh_client, exam_pdf).json()
    Document.objects.filter(pk=old["id"]).update(created_at=timezone.now() - dt.timedelta(hours=3))

    upload(client, exam_pdf)

    assert not Document.objects.filter(pk=old["id"]).exists()
    assert len(stored_files(settings)) == 1
