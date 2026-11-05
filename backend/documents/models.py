import datetime as dt
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


def retention() -> dt.timedelta:
    return dt.timedelta(seconds=settings.PDFNUM_RETENTION_SECONDS)


def idle_time() -> dt.timedelta:
    return dt.timedelta(seconds=settings.PDFNUM_IDLE_SECONDS)


def _expired_condition() -> Q:
    """Older than the retention time, or abandoned (no keep-alive for the idle time)."""
    now = timezone.now()
    return Q(created_at__lte=now - retention()) | Q(last_seen_at__lte=now - idle_time())


def document_path(instance: Document, filename: str) -> str:
    # Never derived from the uploaded file name.
    return f"documents/{instance.pk}.pdf"


class DocumentQuerySet(models.QuerySet):
    def active(self):
        return self.exclude(_expired_condition())

    def expired(self):
        return self.filter(_expired_condition())

    def owned_by(self, owner: str | None):
        """Documents of one browser session; expired ones count as gone."""
        if not owner:
            return self.none()
        return self.active().filter(owner=owner)

    def purge_expired(self) -> int:
        _, deleted = self.expired().delete()
        return deleted.get(self.model._meta.label, 0)


class Document(models.Model):
    """An uploaded exam PDF, private to the browser session that uploaded it."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.CharField(max_length=64, db_index=True)
    file = models.FileField(upload_to=document_path)
    name = models.CharField(max_length=255)
    size = models.PositiveBigIntegerField()
    page_count = models.PositiveIntegerField()
    page_sizes = models.JSONField()  # [[width, height], ...] in points, as displayed
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    # Refreshed by the browser while the exam is open (keep-alive).
    last_seen_at = models.DateTimeField(default=timezone.now, db_index=True)

    objects = DocumentQuerySet.as_manager()

    class Meta:
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.name} ({self.pk})"

    @property
    def expires_at(self) -> dt.datetime:
        return self.created_at + retention()
