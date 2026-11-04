"""Where jobs run: a small thread pool in the web process (no Celery needed)."""

from concurrent.futures import ThreadPoolExecutor
from threading import Lock

from django.conf import settings
from django.db import close_old_connections, connections

from .worker import run_job


class ImmediateRunner:
    """Runs the job right away in the calling thread (tests)."""

    def submit(self, job_id) -> None:
        run_job(job_id)


class ThreadRunner:
    def __init__(self, workers: int):
        self._executor = ThreadPoolExecutor(
            max_workers=workers, thread_name_prefix="pdfnum-generation"
        )

    def submit(self, job_id) -> None:
        self._executor.submit(_run_in_thread, job_id)

    def shutdown(self) -> None:
        self._executor.shutdown(wait=True)


def _run_in_thread(job_id) -> None:
    close_old_connections()
    try:
        run_job(job_id)
    finally:
        connections.close_all()


_thread_runner: ThreadRunner | None = None
_lock = Lock()


def get_runner() -> ImmediateRunner | ThreadRunner:
    global _thread_runner
    if settings.PDFNUM_GENERATION_RUNNER == "immediate":
        return ImmediateRunner()
    with _lock:
        if _thread_runner is None:
            _thread_runner = ThreadRunner(settings.PDFNUM_GENERATION_WORKERS)
        return _thread_runner
