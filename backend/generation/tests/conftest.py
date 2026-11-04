import pytest


@pytest.fixture
def generation_request():
    """Body of POST /api/documents/<id>/generate/ (the original config.json)."""
    return {
        "copies": 2,
        "start": 1,
        "pad_to_even": True,
        "number_format": {"prefix": "", "digits": 4, "suffix": ""},
        "placements": {
            "first": {"x": 227, "y": 661, "font": "cmu-serif", "font_size": 12},
            "odd": {"x": 144, "y": 780, "font": "cmu-serif", "font_size": 12},
        },
    }


@pytest.fixture
def start_generation(client, django_capture_on_commit_callbacks):
    """POST a generation request; the job runs when the request's transaction commits."""

    def _start(document_id, body, using=None):
        with django_capture_on_commit_callbacks(execute=True):
            return (using or client).post(
                f"/api/documents/{document_id}/generate/", body, content_type="application/json"
            )

    return _start


@pytest.fixture
def finished_job(client, uploaded, generation_request, start_generation):
    response = start_generation(uploaded["id"], generation_request)
    assert response.status_code == 202, response.content
    job = client.get(f"/api/jobs/{response.json()['id']}/").json()
    assert job["status"] == "done", job
    return job
