import pytest

from generation.models import GenerationJob

pytestmark = pytest.mark.django_db


def test_generation_is_started_as_a_job(client, uploaded, generation_request, start_generation):
    response = start_generation(uploaded["id"], generation_request)

    assert response.status_code == 202
    body = response.json()
    assert body["document_id"] == uploaded["id"]
    assert body["copies_total"] == 2
    assert body["total_pages"] == 8  # 2 copies x (3 pages + 1 duplex padding page)
    assert body["status"] in {"pending", "running", "done"}
    assert response["Location"] == f"/api/jobs/{body['id']}/"


def test_finished_job_reports_full_progress_and_a_download(finished_job):
    assert finished_job["status"] == "done"
    assert finished_job["stage"] == "done"
    assert finished_job["copies_done"] == finished_job["copies_total"] == 2
    assert finished_job["error"] is None
    assert finished_job["download_url"] == f"/api/jobs/{finished_job['id']}/download/"
    assert finished_job["finished_at"] is not None


def test_padding_can_be_switched_off(uploaded, generation_request, start_generation):
    generation_request["pad_to_even"] = False

    assert start_generation(uploaded["id"], generation_request).json()["total_pages"] == 6


def test_job_stores_the_settings_it_was_run_with(uploaded, generation_request, start_generation):
    job_id = start_generation(uploaded["id"], generation_request).json()["id"]

    params = GenerationJob.objects.get(pk=job_id).params
    assert params["start"] == 1
    assert params["pad_to_even"] is True
    assert params["placements"]["first"]["x"] == 227
    assert params["placements"]["even"] is None


def test_other_sessions_cannot_see_or_start_jobs(
    other_client, finished_job, uploaded, generation_request, start_generation
):
    assert other_client.get(f"/api/jobs/{finished_job['id']}/").status_code == 404
    assert other_client.get(finished_job["download_url"]).status_code == 404
    response = start_generation(uploaded["id"], generation_request, using=other_client)
    assert response.status_code == 404


def test_only_one_active_job_per_session(client, uploaded, generation_request):
    job_body = {**generation_request}
    first = client.post(  # on_commit not executed: the job stays pending
        f"/api/documents/{uploaded['id']}/generate/", job_body, content_type="application/json"
    )
    assert first.status_code == 202

    second = client.post(
        f"/api/documents/{uploaded['id']}/generate/", job_body, content_type="application/json"
    )

    assert second.status_code == 409
    assert second.json()["error"]["code"] == "job_running"


def invalid_fields(response) -> dict:
    assert response.status_code == 400, response.content
    assert response.json()["error"]["code"] == "invalid"
    return response.json()["error"]["fields"]


@pytest.mark.parametrize(
    ("change", "field"),
    [
        ({"copies": 0}, "copies"),
        ({"copies": 10_000}, "copies"),
        ({"copies": "many"}, "copies"),
        ({"start": -1}, "start"),
        ({"pad_to_even": "maybe"}, "pad_to_even"),
        (
            {"placements": {"first": {"x": 1, "y": 1, "font": "nope", "font_size": 1}}},
            "placements.first.font",
        ),
        ({"number_format": {"prefix": "中"}}, "number_format.prefix"),
    ],
)
def test_invalid_requests(client, uploaded, generation_request, start_generation, change, field):
    generation_request.update(change)

    fields = invalid_fields(start_generation(uploaded["id"], generation_request))

    assert field in fields
    assert not GenerationJob.objects.exists()


def test_copies_are_required(uploaded, generation_request, start_generation):
    del generation_request["copies"]

    assert "copies" in invalid_fields(start_generation(uploaded["id"], generation_request))


def test_maximum_copies_follow_the_setting(
    uploaded, generation_request, start_generation, settings
):
    settings.PDFNUM_MAX_COPIES = 3
    generation_request["copies"] = 4

    fields = invalid_fields(start_generation(uploaded["id"], generation_request))

    assert "3" in fields["copies"][0]


def test_too_many_output_pages(uploaded, generation_request, start_generation, settings):
    settings.PDFNUM_MAX_OUTPUT_PAGES = 7  # 2 copies x 4 pages = 8

    response = start_generation(uploaded["id"], generation_request)

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "too_many_pages"
    assert "8" in error["message"]
    assert "7" in error["message"]


def test_not_enough_disk_space(uploaded, generation_request, start_generation, monkeypatch):
    monkeypatch.setattr("generation.services.free_disk_bytes", lambda: 1000)

    response = start_generation(uploaded["id"], generation_request)

    assert response.status_code == 507
    assert response.json()["error"]["code"] == "insufficient_storage"
    assert not GenerationJob.objects.exists()


def test_unknown_document(client, generation_request, start_generation):
    response = start_generation("00000000-0000-4000-8000-000000000000", generation_request)

    assert response.status_code == 404


def test_failed_generation_reports_an_error(
    client, uploaded, generation_request, start_generation, monkeypatch
):
    def broken(*args, **kwargs):
        raise RuntimeError("disk on fire")

    monkeypatch.setattr("generation.worker.generate_copies", broken)

    job_id = start_generation(uploaded["id"], generation_request).json()["id"]
    job = client.get(f"/api/jobs/{job_id}/").json()

    assert job["status"] == "failed"
    assert job["download_url"] is None
    assert job["error"]["code"] == "generation_failed"
    assert "disk on fire" not in job["error"]["message"]


def test_a_new_job_can_start_after_a_failed_one(
    client, uploaded, generation_request, start_generation, monkeypatch
):
    monkeypatch.setattr(
        "generation.worker.generate_copies",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")),
    )
    start_generation(uploaded["id"], generation_request)
    monkeypatch.undo()

    assert start_generation(uploaded["id"], generation_request).status_code == 202


@pytest.mark.parametrize("method", ["put", "patch", "delete", "post"])
def test_jobs_are_read_only(client, finished_job, method):
    response = getattr(client, method)(f"/api/jobs/{finished_job['id']}/")

    assert response.status_code == 405
