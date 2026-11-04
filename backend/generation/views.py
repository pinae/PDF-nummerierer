import logging
import os
from pathlib import Path

from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils.http import content_disposition_header
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from documents.models import Document
from documents.ownership import current_owner
from documents.views import owned_document
from pdfnum.api import ApiError

from .models import GenerationJob
from .serializers import GenerateSerializer
from .services import start_generation

CHUNK_BYTES = 1024 * 1024
TAIL_BYTES = 64

logger = logging.getLogger(__name__)


def job_payload(job: GenerationJob) -> dict:
    done = job.status == GenerationJob.Status.DONE
    return {
        "id": str(job.id),
        "document_id": str(job.document_id),
        "status": job.status,
        "stage": job.stage,
        "copies_done": job.copies_done,
        "copies_total": job.copies_total,
        "total_pages": job.total_pages,
        "error": (
            {"code": job.error_code, "message": job.error_message} if job.error_code else None
        ),
        "download_url": f"/api/jobs/{job.id}/download/" if done else None,
        "created_at": job.created_at.isoformat(),
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
    }


def owned_job(request, job_id) -> GenerationJob:
    return get_object_or_404(GenerationJob.objects.owned_by(current_owner(request)), pk=job_id)


class GenerateView(APIView):
    def post(self, request, document_id):
        document = owned_document(request, document_id)
        serializer = GenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = start_generation(document, document.owner, **serializer.validated_data)
        return Response(
            job_payload(job),
            status=status.HTTP_202_ACCEPTED,
            headers={"Location": f"/api/jobs/{job.id}/"},
        )


class JobView(APIView):
    def get(self, request, job_id):
        return Response(job_payload(owned_job(request, job_id)))


def _stream_then_delete(path: str, document_id):
    """Yield the file and delete document, job and files before its last bytes.

    The final TAIL_BYTES are held back until the deletion is done, so a client
    holding the complete file can never find the exam on the server any more
    (deleting after the last chunk would race with the client's next request).
    A download aborted earlier stops the iteration, deletes nothing and can be
    retried.
    """
    with open(path, "rb") as file:
        body_end = max(os.fstat(file.fileno()).st_size - TAIL_BYTES, 0)
        while (position := file.tell()) < body_end:
            yield file.read(min(CHUNK_BYTES, body_end - position))
        tail = file.read()
    try:
        Document.objects.filter(pk=document_id).delete()
    except Exception:
        # Still deliver the file; the periodic cleanup deletes it at the latest.
        logger.exception("Could not delete document %s after its download", document_id)
    yield tail


class JobDownloadView(APIView):
    def get(self, request, job_id):
        job = owned_job(request, job_id)
        if job.status != GenerationJob.Status.DONE or not job.output:
            raise ApiError(status.HTTP_409_CONFLICT, "not_ready", "The copies are not ready yet.")
        path = job.output.path
        response = StreamingHttpResponse(
            _stream_then_delete(path, job.document_id), content_type="application/pdf"
        )
        filename = f"{Path(job.document.name).stem}-numbered.pdf"
        response["Content-Disposition"] = content_disposition_header(True, filename)
        response["Content-Length"] = str(Path(path).stat().st_size)
        response["Cache-Control"] = "no-store, private"
        return response
