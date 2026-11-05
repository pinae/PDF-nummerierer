"""Uploads abandoned by closing the browser are deleted after a short idle time.

An open workspace sends a keep-alive every minute; without it a document
counts as gone after PDFNUM_IDLE_SECONDS, long before the hard retention limit.
"""

import datetime as dt
from pathlib import Path

import pytest
from django.utils import timezone

from documents.models import Document

pytestmark = pytest.mark.django_db


def idle_for(document_id, seconds: int) -> None:
    Document.objects.filter(pk=document_id).update(
        last_seen_at=timezone.now() - dt.timedelta(seconds=seconds)
    )


def test_keepalive_marks_the_document_as_in_use(client, uploaded):
    idle_for(uploaded["id"], 600)

    response = client.post(f"/api/documents/{uploaded['id']}/keepalive/")

    assert response.status_code == 204
    last_seen = Document.objects.get(pk=uploaded["id"]).last_seen_at
    assert timezone.now() - last_seen < dt.timedelta(seconds=5)


def test_idle_documents_are_gone_before_they_are_purged(client, uploaded, settings):
    idle_for(uploaded["id"], settings.PDFNUM_IDLE_SECONDS + 1)

    assert client.get(f"/api/documents/{uploaded['id']}/").status_code == 404
    assert client.post(f"/api/documents/{uploaded['id']}/keepalive/").status_code == 404


def test_documents_within_the_idle_time_stay(client, uploaded, settings):
    idle_for(uploaded["id"], settings.PDFNUM_IDLE_SECONDS - 60)

    assert client.get(f"/api/documents/{uploaded['id']}/").status_code == 200


def test_keepalive_never_extends_the_hard_retention_limit(client, uploaded):
    Document.objects.filter(pk=uploaded["id"]).update(
        created_at=timezone.now() - dt.timedelta(hours=2, seconds=1)
    )

    assert client.post(f"/api/documents/{uploaded['id']}/keepalive/").status_code == 404


def test_other_sessions_cannot_keep_a_document_alive(other_client, uploaded):
    assert other_client.post(f"/api/documents/{uploaded['id']}/keepalive/").status_code == 404


def test_purge_removes_idle_documents_and_their_files(uploaded, settings):
    idle_for(uploaded["id"], settings.PDFNUM_IDLE_SECONDS + 1)
    path = Document.objects.get(pk=uploaded["id"]).file.path

    assert Document.objects.purge_expired() == 1
    assert not Document.objects.exists()
    assert not Path(path).exists()


def test_keepalive_only_accepts_post(client, uploaded):
    assert client.get(f"/api/documents/{uploaded['id']}/keepalive/").status_code == 405
