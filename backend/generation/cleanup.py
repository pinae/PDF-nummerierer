"""Periodic cleanup (run `manage.py cleanup` every few minutes, e.g. via cron)."""

import datetime as dt
import time
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.contrib.sessions.backends.db import SessionStore
from django.utils import timezone

from documents.models import Document

from .models import GenerationJob
from .worker import OUTPUT_DIR

MEDIA_SUBDIRS = ("documents", OUTPUT_DIR)


@dataclass(frozen=True)
class CleanupResult:
    documents: int
    interrupted_jobs: int
    orphaned_files: int
    temp_files: int


def run() -> CleanupResult:
    SessionStore.clear_expired()
    return CleanupResult(
        documents=Document.objects.purge_expired(),
        interrupted_jobs=_mark_interrupted_jobs(),
        orphaned_files=_remove_orphaned_files(),
        temp_files=_remove_old_files(settings.FILE_UPLOAD_TEMP_DIR),
    )


def _mark_interrupted_jobs() -> int:
    """Jobs whose worker vanished (e.g. a restart) would otherwise stay pending forever."""
    cutoff = timezone.now() - dt.timedelta(seconds=settings.PDFNUM_JOB_TIMEOUT_SECONDS)
    return (
        GenerationJob.objects.active()
        .filter(updated_at__lt=cutoff)
        .update(
            status=GenerationJob.Status.FAILED,
            error_code="interrupted",
            error_message="The generation was interrupted. Please start it again.",
            finished_at=timezone.now(),
        )
    )


def _remove_orphaned_files() -> int:
    referenced = set(Document.objects.values_list("file", flat=True)) | set(
        GenerationJob.objects.exclude(output="").values_list("output", flat=True)
    )
    media = Path(settings.MEDIA_ROOT)
    removed = 0
    for subdir in MEDIA_SUBDIRS:
        removed += _remove_old_files(
            media / subdir, keep=lambda path: path.relative_to(media).as_posix() in referenced
        )
    return removed


def _remove_old_files(directory, keep=lambda path: False) -> int:
    if not directory or not Path(directory).is_dir():
        return 0
    cutoff = time.time() - settings.PDFNUM_RETENTION_SECONDS
    removed = 0
    for path in Path(directory).iterdir():
        if path.is_file() and path.stat().st_mtime < cutoff and not keep(path):
            path.unlink(missing_ok=True)
            removed += 1
    return removed
