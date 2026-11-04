import shutil
from pathlib import Path

from django.conf import settings
from django.db import transaction
from rest_framework import status

from documents.models import Document
from pdfnum.api import ApiError
from stamping import StampConfig

from . import runner
from .models import GenerationJob
from .params import to_params

BYTES_PER_OUTPUT_PAGE = 2048  # measured ~400 B; generous margin
DISK_RESERVE_BYTES = 100 * 1024 * 1024


def free_disk_bytes() -> int:
    media = Path(settings.MEDIA_ROOT)
    media.mkdir(parents=True, exist_ok=True)
    return shutil.disk_usage(media).free


def start_generation(
    document: Document,
    owner: str,
    *,
    stamp_config: StampConfig,
    copies: int,
    start: int,
    pad_to_even: bool,
) -> GenerationJob:
    """Check the limits, create a pending job and queue it once the request commits."""
    pages_per_copy = document.page_count + (pad_to_even and document.page_count % 2 == 1)
    total_pages = copies * pages_per_copy
    if total_pages > settings.PDFNUM_MAX_OUTPUT_PAGES:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            "too_many_pages",
            f"{copies} copies would have {total_pages} pages; at most "
            f"{settings.PDFNUM_MAX_OUTPUT_PAGES} pages can be generated at once. "
            "Please generate fewer copies per run.",
        )
    needed = document.size + total_pages * BYTES_PER_OUTPUT_PAGE + DISK_RESERVE_BYTES
    if free_disk_bytes() < needed:
        raise ApiError(
            status.HTTP_507_INSUFFICIENT_STORAGE,
            "insufficient_storage",
            "The server does not have enough free space for this many copies right now.",
        )

    with transaction.atomic():
        if GenerationJob.objects.owned_by(owner).active().exists():
            raise ApiError(
                status.HTTP_409_CONFLICT,
                "job_running",
                "Your copies are still being generated. Please wait until they are ready.",
            )
        job = GenerationJob.objects.create(
            document=document,
            owner=owner,
            copies_total=copies,
            total_pages=total_pages,
            params=to_params(stamp_config, start=start, pad_to_even=pad_to_even),
        )
        transaction.on_commit(lambda: runner.get_runner().submit(job.pk))
    return job
