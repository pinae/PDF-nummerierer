"""The frontend states the limits before an upload, so it reads them from here."""


def test_limits_reflect_the_settings(client, settings):
    settings.PDFNUM_MAX_UPLOAD_BYTES = 1234
    settings.PDFNUM_RETENTION_SECONDS = 600
    settings.PDFNUM_MAX_COPIES = 77
    settings.PDFNUM_MAX_OUTPUT_PAGES = 5000
    settings.PDFNUM_IDLE_SECONDS = 900

    response = client.get("/api/limits/")

    assert response.status_code == 200
    assert response.json() == {
        "max_upload_bytes": 1234,
        "retention_seconds": 600,
        "max_copies": 77,
        "max_output_pages": 5000,
        "idle_seconds": 900,
    }


def test_limits_are_read_only(client):
    assert client.post("/api/limits/").status_code == 405
