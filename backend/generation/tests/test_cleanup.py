import datetime as dt
import os
import time
from io import StringIO
from pathlib import Path

import pytest
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from django.core.management import call_command
from django.utils import timezone

from documents.models import Document
from generation import cleanup
from generation.models import GenerationJob

pytestmark = pytest.mark.django_db


def age(path: Path, seconds: float) -> None:
    old = time.time() - seconds
    os.utime(path, (old, old))


def test_expired_documents_and_their_outputs_are_removed(finished_job, uploaded, settings):
    Document.objects.update(created_at=timezone.now() - dt.timedelta(hours=3))

    result = cleanup.run()

    assert result.documents == 1
    assert not GenerationJob.objects.exists()
    assert [p for p in Path(settings.MEDIA_ROOT).rglob("*") if p.is_file()] == []


def test_fresh_documents_stay(finished_job, settings):
    cleanup.run()

    assert GenerationJob.objects.count() == 1
    assert len([p for p in Path(settings.MEDIA_ROOT).rglob("*") if p.is_file()]) == 2


def test_jobs_without_heartbeat_are_marked_interrupted(client, uploaded, generation_request):
    job_id = client.post(
        f"/api/documents/{uploaded['id']}/generate/",
        generation_request,
        content_type="application/json",
    ).json()["id"]
    GenerationJob.objects.update(
        status=GenerationJob.Status.RUNNING,
        updated_at=timezone.now() - dt.timedelta(minutes=31),
    )

    result = cleanup.run()

    assert result.interrupted_jobs == 1
    job = client.get(f"/api/jobs/{job_id}/").json()
    assert job["status"] == "failed"
    assert job["error"]["code"] == "interrupted"


def test_orphaned_files_are_removed_once_they_are_old(settings, finished_job):
    outputs = Path(settings.MEDIA_ROOT) / "outputs"
    old_orphan = outputs / "lost.pdf"
    new_orphan = outputs / "just-written.pdf.part"
    old_orphan.write_bytes(b"x")
    new_orphan.write_bytes(b"x")
    age(old_orphan, 3 * 60 * 60)
    referenced = Path(GenerationJob.objects.get().output.path)
    age(referenced, 3 * 60 * 60)

    result = cleanup.run()

    assert result.orphaned_files == 1
    assert not old_orphan.exists()
    assert new_orphan.exists()
    assert referenced.exists()


def test_abandoned_upload_temp_files_are_removed(settings, tmp_path):
    settings.FILE_UPLOAD_TEMP_DIR = tmp_path / "upload-tmp"
    settings.FILE_UPLOAD_TEMP_DIR.mkdir()
    old = settings.FILE_UPLOAD_TEMP_DIR / "abc.upload.pdf"
    old.write_bytes(b"x")
    age(old, 3 * 60 * 60)

    cleanup.run()

    assert not old.exists()


def test_expired_sessions_are_removed():
    session = SessionStore()
    session["x"] = 1
    session.create()
    Session.objects.update(expire_date=timezone.now() - dt.timedelta(seconds=1))

    cleanup.run()

    assert not Session.objects.exists()


def test_management_command_reports_what_it_did(finished_job):
    Document.objects.update(created_at=timezone.now() - dt.timedelta(hours=3))
    out = StringIO()

    call_command("cleanup", stdout=out)

    assert "1 expired document" in out.getvalue()
