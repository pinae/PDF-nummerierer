"""A document is reachable only from the browser session that uploaded it."""

import datetime as dt

import pytest
from django.utils import timezone

from documents.models import Document

pytestmark = pytest.mark.django_db

UNKNOWN = "00000000-0000-4000-8000-000000000000"


def test_owner_can_read_metadata(client, uploaded):
    response = client.get(f"/api/documents/{uploaded['id']}/")

    assert response.status_code == 200
    assert response.json() == uploaded


def test_owner_can_fetch_the_pdf_for_the_preview(client, uploaded, exam_pdf):
    response = client.get(f"/api/documents/{uploaded['id']}/file/")

    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response["X-Content-Type-Options"] == "nosniff"
    assert "no-store" in response["Cache-Control"]
    assert response["Content-Disposition"].startswith("inline")
    assert b"".join(response.streaming_content) == exam_pdf


@pytest.mark.parametrize("suffix", ["", "file/"])
def test_other_sessions_get_404(other_client, uploaded, suffix):
    response = other_client.get(f"/api/documents/{uploaded['id']}/{suffix}")

    assert response.status_code == 404


@pytest.mark.parametrize("suffix", ["", "file/"])
def test_unknown_documents_get_the_same_404(client, uploaded, suffix):
    response = client.get(f"/api/documents/{UNKNOWN}/{suffix}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_malformed_ids_get_404(client, uploaded):
    assert client.get("/api/documents/1/").status_code == 404


@pytest.mark.parametrize("suffix", ["", "file/"])
def test_expired_documents_are_gone_before_they_are_purged(client, uploaded, suffix):
    Document.objects.filter(pk=uploaded["id"]).update(
        created_at=timezone.now() - dt.timedelta(hours=2, seconds=1)
    )

    assert client.get(f"/api/documents/{uploaded['id']}/{suffix}").status_code == 404


def test_owner_can_delete_now(client, uploaded, settings):
    response = client.delete(f"/api/documents/{uploaded['id']}/")

    assert response.status_code == 204
    assert client.get(f"/api/documents/{uploaded['id']}/").status_code == 404
    assert not any(p.is_file() for p in (settings.MEDIA_ROOT / "documents").iterdir())


def test_other_sessions_cannot_delete(other_client, client, uploaded):
    response = other_client.delete(f"/api/documents/{uploaded['id']}/")

    assert response.status_code == 404
    assert client.get(f"/api/documents/{uploaded['id']}/").status_code == 200


@pytest.mark.parametrize("suffix", ["", "file/"])
def test_session_without_documents_gets_404(fresh_client, uploaded, suffix):
    assert fresh_client.get(f"/api/documents/{uploaded['id']}/{suffix}").status_code == 404


@pytest.mark.parametrize(
    ("method", "suffix"), [("put", ""), ("patch", ""), ("post", "file/"), ("delete", "file/")]
)
def test_unsupported_methods(client, uploaded, method, suffix):
    response = getattr(client, method)(f"/api/documents/{uploaded['id']}/{suffix}")

    assert response.status_code == 405
