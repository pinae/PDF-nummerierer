from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.db.models import Max

from stamping import StampConfig

from .models import NumberingConfig, NumberPlacement, name_key, normalize_name

SAVE_ATTEMPTS = 3


@dataclass(frozen=True)
class SaveResult:
    config: NumberingConfig
    created: bool


def save_config(name: str, stamp_config: StampConfig) -> SaveResult:
    """Save `stamp_config` as the next version of `name`.

    Never changes existing versions. Saving content identical to the latest
    version returns that version instead of creating a duplicate.
    """
    display_name, key = normalize_name(name), name_key(name)
    if not display_name:
        raise ValueError("A config needs a name.")
    for attempt in range(SAVE_ATTEMPTS):
        try:
            with transaction.atomic():
                return _save_version(display_name, key, stamp_config)
        except IntegrityError:
            # Someone else saved the same version number at the same moment.
            if attempt == SAVE_ATTEMPTS - 1:
                raise
    raise AssertionError("unreachable")


def _save_version(display_name: str, key: str, stamp_config: StampConfig) -> SaveResult:
    latest = NumberingConfig.objects.filter(name_key=key).order_by("-version").first()
    if latest is not None and latest.to_stamp_config() == stamp_config:
        return SaveResult(latest, created=False)

    fmt = stamp_config.number_format
    config = NumberingConfig.objects.create(
        name=display_name,
        name_key=key,
        version=_next_version(key),
        prefix=fmt.prefix,
        digits=fmt.digits,
        suffix=fmt.suffix,
    )
    NumberPlacement.objects.bulk_create(
        NumberPlacement(
            config=config,
            role=role.value,
            x=placement.x,
            y=placement.y,
            font=placement.font_id,
            font_size=placement.font_size,
        )
        for role, placement in stamp_config.placements.items()
    )
    return SaveResult(config, created=True)


def _next_version(key: str) -> int:
    current = NumberingConfig.objects.filter(name_key=key).aggregate(Max("version"))
    return (current["version__max"] or 0) + 1
