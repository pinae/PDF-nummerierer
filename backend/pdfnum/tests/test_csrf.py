"""CSRF must be enforced on every mutating API request, although nobody logs in.

DRF exempts its views from Django's CSRF middleware and only re-checks CSRF
for authenticated sessions, so this is easy to lose silently."""

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from stamping.tests.pdfs import three_page_exam


@pytest.fixture
def strict_client():
    return Client(enforce_csrf_checks=True)


def csrf_token(client) -> str:
    response = client.get("/api/csrf/")
    assert response.status_code == 200
    return response.cookies["csrftoken"].value


def upload(client, **headers):
    pdf = SimpleUploadedFile("exam.pdf", three_page_exam(), content_type="application/pdf")
    return client.post("/api/documents/", {"file": pdf}, **headers)


def test_csrf_endpoint_sets_a_cookie_readable_by_the_spa(strict_client):
    response = strict_client.get("/api/csrf/")

    assert response.status_code == 200
    cookie = response.cookies["csrftoken"]
    assert cookie.value
    assert not cookie["httponly"]


@pytest.mark.django_db
def test_upload_without_token_is_rejected(strict_client):
    csrf_token(strict_client)

    response = upload(strict_client)

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf_failed"


@pytest.mark.django_db
def test_upload_with_token_is_accepted(strict_client):
    token = csrf_token(strict_client)

    response = upload(strict_client, HTTP_X_CSRFTOKEN=token)

    assert response.status_code == 201


@pytest.mark.django_db
def test_delete_without_token_is_rejected_and_keeps_the_document(strict_client):
    token = csrf_token(strict_client)
    document_id = upload(strict_client, HTTP_X_CSRFTOKEN=token).json()["id"]

    response = strict_client.delete(f"/api/documents/{document_id}/")

    assert response.status_code == 403
    assert strict_client.get(f"/api/documents/{document_id}/").status_code == 200


@pytest.mark.django_db
def test_cross_origin_request_is_rejected_even_with_a_token(strict_client):
    token = csrf_token(strict_client)

    response = upload(strict_client, HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="https://evil.example")

    assert response.status_code == 403
