"""Runs one generation job: stamp the copies, write the output, record progress."""

import logging
import os
import time
from collections.abc import Callable
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from stamping import Progress, StampingError, generate_copies

from .models import GenerationJob
from .params import stamp_config_from_params

logger = logging.getLogger(__name__)

OUTPUT_DIR = "outputs"
GENERIC_FAILURE = "The copies could not be generated. Please try again or upload the PDF anew."


class JobCancelled(Exception):
    """The job (or its document) was deleted while it was running."""


def _update(job_id, **fields) -> bool:
    now = timezone.now()
    return GenerationJob.objects.filter(pk=job_id).update(updated_at=now, **fields) > 0


class ProgressRecorder:
    """Progress callback that writes to the database on stage changes, for the last
    copy and otherwise at most every `min_interval` seconds."""

    def __init__(
        self, job_id, min_interval: float = 0.5, clock: Callable[[], float] = time.monotonic
    ):
        self.job_id = job_id
        self.min_interval = min_interval
        self.clock = clock
        self._stage: str | None = None
        self._last_write = float("-inf")

    def write(self, **fields) -> bool:
        return _update(self.job_id, **fields)

    def __call__(self, event: Progress) -> None:
        now = self.clock()
        due = (
            event.stage != self._stage
            or event.copies_done == event.copies_total
            or now - self._last_write >= self.min_interval
        )
        if not due:
            return
        if not self.write(stage=event.stage, copies_done=event.copies_done):
            raise JobCancelled
        self._stage = event.stage
        self._last_write = now


def run_job(job_id) -> None:
    job = GenerationJob.objects.select_related("document").filter(pk=job_id).first()
    if job is None or not _update(job_id, status=GenerationJob.Status.RUNNING):
        return

    output_dir = Path(settings.MEDIA_ROOT) / OUTPUT_DIR
    output_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    final = output_dir / f"{job.pk}.pdf"
    part = output_dir / f"{job.pk}.pdf.part"
    try:
        os.close(os.open(part, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600))
        params = job.params
        with job.document.file.open("rb") as source:
            generate_copies(
                source,
                str(part),
                stamp_config_from_params(params),
                copies=job.copies_total,
                start=params["start"],
                pad_to_even=params["pad_to_even"],
                on_progress=ProgressRecorder(job_id),
            )
        os.replace(part, final)
        finished = _update(
            job_id,
            status=GenerationJob.Status.DONE,
            stage="done",
            copies_done=job.copies_total,
            output=f"{OUTPUT_DIR}/{final.name}",
            finished_at=timezone.now(),
        )
        if not finished:
            final.unlink(missing_ok=True)
    except JobCancelled:
        logger.info("Generation job %s was cancelled", job_id)
    except StampingError as error:
        _fail(job_id, str(error))
    except Exception:
        logger.exception("Generation job %s failed", job_id)
        _fail(job_id, GENERIC_FAILURE)
    finally:
        part.unlink(missing_ok=True)


def _fail(job_id, message: str) -> None:
    _update(
        job_id,
        status=GenerationJob.Status.FAILED,
        error_code="generation_failed",
        error_message=message,
        output="",
        finished_at=timezone.now(),
    )
