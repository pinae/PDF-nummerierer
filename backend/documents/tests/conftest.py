import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from stamping.tests.pdfs import three_page_exam


@pytest.fixture
def exam_pdf() -> bytes:
    return three_page_exam()


@pytest.fixture
def upload():
    def _upload(client, data: bytes, name: str = "exam.pdf"):
        file = SimpleUploadedFile(name, data, content_type="application/pdf")
        return client.post("/api/documents/", {"file": file})

    return _upload


@pytest.fixture
def uploaded(client, upload, exam_pdf):
    """A document uploaded by `client`; returns its JSON payload."""
    response = upload(client, exam_pdf)
    assert response.status_code == 201, response.content
    return response.json()


@pytest.fixture
def fresh_client():
    """A browser that has never uploaded anything."""
    return Client()


@pytest.fixture
def other_client(upload, exam_pdf):
    """Another user (e.g. a student) with an active session of their own: they
    uploaded a document, so their session carries a valid owner token."""
    other = Client()
    assert upload(other, exam_pdf).status_code == 201
    return other
