import uuid

from django.db import models
from django.db.models import OuterRef, Subquery
from django.utils import timezone

from stamping import NumberFormat, PageRole, Placement, StampConfig

MAX_NAME_LENGTH = 80


def normalize_name(name: str) -> str:
    return " ".join(name.split())


def name_key(name: str) -> str:
    """Versions are grouped by name, ignoring case and extra whitespace."""
    return normalize_name(name).casefold()


class Immutable(models.Model):
    """Rows that can be created but never changed (saving creates new versions)."""

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise TypeError(f"{type(self).__name__} rows are immutable; save a new version.")
        super().save(*args, **kwargs)


class NumberingConfigQuerySet(models.QuerySet):
    def latest_versions(self):
        newest = (
            NumberingConfig.objects.filter(name_key=OuterRef("name_key"))
            .order_by("-version")
            .values("pk")[:1]
        )
        return self.filter(pk=Subquery(newest)).order_by("name_key").prefetch_related("placements")

    def versions_of(self, config: NumberingConfig):
        return (
            self.filter(name_key=config.name_key)
            .order_by("-version")
            .prefetch_related("placements")
        )


class NumberingConfig(Immutable):
    """One version of a named, globally shared numbering configuration."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=MAX_NAME_LENGTH)
    name_key = models.CharField(max_length=MAX_NAME_LENGTH, db_index=True)
    version = models.PositiveIntegerField()
    prefix = models.CharField(max_length=40, blank=True)
    digits = models.PositiveSmallIntegerField()
    suffix = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    objects = NumberingConfigQuerySet.as_manager()

    class Meta:
        constraints = (
            models.UniqueConstraint(fields=("name_key", "version"), name="unique_config_version"),
        )

    def __str__(self) -> str:
        return f"{self.name} v{self.version}"

    def to_stamp_config(self) -> StampConfig:
        return StampConfig(
            placements={
                PageRole(p.role): Placement(p.x, p.y, p.font, p.font_size)
                for p in self.placements.all()
            },
            number_format=NumberFormat(self.prefix, self.digits, self.suffix),
        )


class NumberPlacement(Immutable):
    config = models.ForeignKey(NumberingConfig, on_delete=models.CASCADE, related_name="placements")
    role = models.CharField(max_length=8, choices=[(role.value, role.name) for role in PageRole])
    x = models.FloatField()
    y = models.FloatField()
    font = models.CharField(max_length=40)
    font_size = models.FloatField()

    class Meta:
        constraints = (models.UniqueConstraint(fields=("config", "role"), name="unique_role"),)

    def __str__(self) -> str:
        return f"{self.config} {self.role}"
