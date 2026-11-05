from django.conf import settings
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from pdfnum.api import ApiError, UploadRateThrottle

from .models import Document
from .ownership import claim_owner, current_owner
from .validation import display_name, validate_pdf


def document_payload(document: Document) -> dict:
    return {
        "id": str(document.id),
        "name": document.name,
        "size": document.size,
        "page_count": document.page_count,
        "page_sizes": document.page_sizes,
        "created_at": document.created_at.isoformat(),
        "expires_at": document.expires_at.isoformat(),
    }


def owned_document(request, document_id) -> Document:
    """The document if the current session owns it; 404 for everything else."""
    return get_object_or_404(Document.objects.owned_by(current_owner(request)), pk=document_id)


class DocumentCollectionView(APIView):
    parser_classes = (MultiPartParser,)
    throttle_classes = (UploadRateThrottle,)

    def post(self, request):
        Document.objects.purge_expired()
        upload = request.FILES.get("file")
        if upload is None:
            raise ApiError(status.HTTP_400_BAD_REQUEST, "missing_file", "Please choose a PDF.")
        pages = validate_pdf(upload, settings.PDFNUM_MAX_UPLOAD_BYTES)

        document = Document(
            owner=claim_owner(request),
            name=display_name(upload.name),
            size=upload.size,
            page_count=len(pages),
            page_sizes=[[round(p.width, 2), round(p.height, 2)] for p in pages],
        )
        with transaction.atomic():
            document.file.save(f"{document.pk}.pdf", upload, save=True)
        return Response(document_payload(document), status=status.HTTP_201_CREATED)


class DocumentDetailView(APIView):
    def get(self, request, document_id):
        return Response(document_payload(owned_document(request, document_id)))

    def delete(self, request, document_id):
        owned_document(request, document_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DocumentKeepAliveView(APIView):
    """Sent every minute by an open workspace; abandoned uploads stop sending it."""

    def post(self, request, document_id):
        document = owned_document(request, document_id)
        Document.objects.filter(pk=document.pk).update(last_seen_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)


class DocumentFileView(APIView):
    def get(self, request, document_id):
        document = owned_document(request, document_id)
        response = FileResponse(
            document.file.open("rb"),
            content_type="application/pdf",
            as_attachment=False,
            filename=document.name,
        )
        response["Cache-Control"] = "no-store, private"
        return response
