"""The real background runner, with committed transactions and a polling client."""

import time

import pytest

from generation.runner import ThreadRunner

pytestmark = pytest.mark.django_db(transaction=True)


def test_job_runs_in_the_background_and_progress_can_be_polled(
    client, uploaded, generation_request, settings, monkeypatch
):
    settings.PDFNUM_GENERATION_RUNNER = "thread"
    runner = ThreadRunner(workers=1)
    monkeypatch.setattr("generation.runner.get_runner", lambda: runner)
    generation_request["copies"] = 50

    job = client.post(
        f"/api/documents/{uploaded['id']}/generate/",
        generation_request,
        content_type="application/json",
    ).json()

    seen = []
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        status = client.get(f"/api/jobs/{job['id']}/").json()
        seen.append(status["status"])
        if status["status"] in ("done", "failed"):
            break
        time.sleep(0.05)
    runner.shutdown()

    assert status["status"] == "done", status
    assert status["copies_done"] == 50
    assert seen[0] in ("pending", "running", "done")
