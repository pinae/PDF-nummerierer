import uuid

from django.db import models
from django.utils import timezone

from documents.models import Document


class GenerationJobQuerySet(models.QuerySet):
    def owned_by(self, owner: str | None):
        """Jobs of one browser session; they live exactly as long as their document."""
        if not owner:
            return self.none()
        return self.filter(owner=owner, document__in=Document.objects.active())

    def active(self):
        return self.filter(status__in=(GenerationJob.Status.PENDING, GenerationJob.Status.RUNNING))


class GenerationJob(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        RUNNING = "running"
        DONE = "done"
        FAILED = "failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="jobs")
    owner = models.CharField(max_length=64, db_index=True)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.PENDING)
    stage = models.CharField(max_length=16, blank=True)
    copies_total = models.PositiveIntegerField()
    copies_done = models.PositiveIntegerField(default=0)
    total_pages = models.PositiveIntegerField()
    params = models.JSONField()
    output = models.FileField(blank=True)
    error_code = models.CharField(max_length=32, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)  # heartbeat of the worker
    finished_at = models.DateTimeField(null=True, blank=True)

    objects = GenerationJobQuerySet.as_manager()

    class Meta:
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.pk} ({self.status})"
