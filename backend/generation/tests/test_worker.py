import os
import stat
from pathlib import Path

import pytest

from generation import worker
from generation.models import GenerationJob
from stamping import Progress

pytestmark = pytest.mark.django_db


@pytest.fixture
def pending_job(client, uploaded, generation_request):
    job_id = client.post(  # on_commit not executed: the job stays pending
        f"/api/documents/{uploaded['id']}/generate/",
        generation_request,
        content_type="application/json",
    ).json()["id"]
    return GenerationJob.objects.get(pk=job_id)


def test_run_job_writes_a_private_output_file(pending_job, settings):
    worker.run_job(pending_job.pk)

    job = GenerationJob.objects.get(pk=pending_job.pk)
    assert job.status == GenerationJob.Status.DONE
    path = Path(job.output.path)
    assert path == Path(settings.MEDIA_ROOT) / "outputs" / f"{job.pk}.pdf"
    assert stat.S_IMODE(os.stat(path).st_mode) == 0o600
    assert not list(path.parent.glob("*.part"))


def test_run_job_for_a_deleted_job_does_nothing(pending_job):
    pending_job.document.delete()

    worker.run_job(pending_job.pk)

    assert not GenerationJob.objects.exists()


def test_deleting_the_document_during_generation_cancels_the_job(
    pending_job, monkeypatch, settings
):
    real = worker.generate_copies

    def delete_midway(source, target, config, *, on_progress, **kwargs):
        def progress(event: Progress):
            if event.copies_done == 1:
                pending_job.document.delete()
            on_progress(event)

        return real(source, target, config, on_progress=progress, **kwargs)

    monkeypatch.setattr(worker, "generate_copies", delete_midway)

    worker.run_job(pending_job.pk)

    assert not GenerationJob.objects.exists()
    assert [p for p in Path(settings.MEDIA_ROOT).rglob("*") if p.is_file()] == []


def test_failure_removes_the_partial_output(pending_job, monkeypatch, settings):
    def fail_while_writing(source, target, config, **kwargs):
        Path(target).write_bytes(b"%PDF-partial")
        raise RuntimeError("crash")

    monkeypatch.setattr(worker, "generate_copies", fail_while_writing)

    worker.run_job(pending_job.pk)

    job = GenerationJob.objects.get(pk=pending_job.pk)
    assert job.status == GenerationJob.Status.FAILED
    assert not job.output
    assert list((Path(settings.MEDIA_ROOT) / "outputs").glob("*")) == []


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


def test_progress_is_written_on_stage_changes_and_at_most_twice_a_second(pending_job):
    clock = FakeClock()
    recorder = worker.ProgressRecorder(pending_job.pk, min_interval=0.5, clock=clock)
    writes = []
    recorder.write = lambda **fields: writes.append(fields) or True

    recorder(Progress("preparing", 0, 3))
    recorder(Progress("stamping", 0, 3))
    clock.now = 0.1
    recorder(Progress("stamping", 1, 3))  # too soon: skipped
    clock.now = 0.7
    recorder(Progress("stamping", 2, 3))
    clock.now = 0.8
    recorder(Progress("stamping", 3, 3))  # last copy: always written
    recorder(Progress("writing", 3, 3))

    assert [(w["stage"], w["copies_done"]) for w in writes] == [
        ("preparing", 0),
        ("stamping", 0),
        ("stamping", 2),
        ("stamping", 3),
        ("writing", 3),
    ]


def test_progress_raises_when_the_job_disappeared(pending_job):
    recorder = worker.ProgressRecorder(pending_job.pk)
    pending_job.document.delete()

    with pytest.raises(worker.JobCancelled):
        recorder(Progress("stamping", 1, 2))
