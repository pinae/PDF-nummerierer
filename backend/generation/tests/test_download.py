"""The download is the end of the flow: afterwards nothing of the exam is left."""

import io
from pathlib import Path

import pytest
from pypdf import PdfReader

from documents.models import Document
from generation.models import GenerationJob

pytestmark = pytest.mark.django_db


def files_in(settings) -> list[Path]:
    return [p for p in Path(settings.MEDIA_ROOT).rglob("*") if p.is_file()]


def test_download_delivers_the_numbered_pdf(client, finished_job):
    response = client.get(finished_job["download_url"])

    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response["Content-Disposition"] == 'attachment; filename="exam-numbered.pdf"'
    assert "no-store" in response["Cache-Control"]
    data = b"".join(response.streaming_content)
    assert int(response["Content-Length"]) == len(data)
    pages = [page.extract_text() for page in PdfReader(io.BytesIO(data)).pages]
    assert len(pages) == 8
    assert "0001" in pages[0]
    assert "0002" in pages[4]


def test_completed_download_deletes_everything(client, finished_job, uploaded, settings):
    assert len(files_in(settings)) == 2  # upload + output

    response = client.get(finished_job["download_url"])
    b"".join(response.streaming_content)
    response.close()

    assert files_in(settings) == []
    assert not Document.objects.exists()
    assert not GenerationJob.objects.exists()
    assert client.get(f"/api/documents/{uploaded['id']}/").status_code == 404
    assert client.get(f"/api/jobs/{finished_job['id']}/").status_code == 404


def test_interrupted_download_keeps_the_files_for_a_retry(client, finished_job, settings):
    response = client.get(finished_job["download_url"])
    next(iter(response.streaming_content))
    response.close()

    assert len(files_in(settings)) == 2
    retry = client.get(finished_job["download_url"])
    assert retry.status_code == 200
    assert b"".join(retry.streaming_content).startswith(b"%PDF-")


def test_download_before_the_job_is_done(client, uploaded, generation_request):
    job_id = client.post(  # on_commit not executed: the job stays pending
        f"/api/documents/{uploaded['id']}/generate/",
        generation_request,
        content_type="application/json",
    ).json()["id"]

    response = client.get(f"/api/jobs/{job_id}/download/")

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "not_ready"


def test_delete_now_also_removes_the_output(client, finished_job, uploaded, settings):
    client.delete(f"/api/documents/{uploaded['id']}/")

    assert files_in(settings) == []
    assert client.get(f"/api/jobs/{finished_job['id']}/").status_code == 404


def test_download_name_is_derived_from_the_upload(
    client, upload, exam_pdf, generation_request, start_generation
):
    document = upload(client, exam_pdf, name="HCI Exam 2026.pdf").json()
    job = start_generation(document["id"], generation_request).json()

    response = client.get(f"/api/jobs/{job['id']}/download/")

    assert response["Content-Disposition"] == 'attachment; filename="HCI Exam 2026-numbered.pdf"'
