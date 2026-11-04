from rest_framework import serializers

from stamping import FONTS, NumberFormat, PageRole, Placement, StampConfig, get_font
from stamping.config import MAX_COORDINATE, MAX_FONT_SIZE, MIN_FONT_SIZE
from stamping.numbering import MAX_AFFIX_LENGTH, MAX_DIGITS

from .models import MAX_NAME_LENGTH, NumberingConfig


def _printable(value: str) -> str:
    if not value.isprintable():
        raise serializers.ValidationError("Use a single line of printable characters.")
    return value


class PlacementSerializer(serializers.Serializer):
    x = serializers.FloatField(min_value=0, max_value=MAX_COORDINATE)
    y = serializers.FloatField(min_value=0, max_value=MAX_COORDINATE)
    font = serializers.ChoiceField(choices=[font.id for font in FONTS])
    font_size = serializers.FloatField(min_value=MIN_FONT_SIZE, max_value=MAX_FONT_SIZE)

    def validate(self, attrs) -> Placement:
        return Placement(attrs["x"], attrs["y"], attrs["font"], attrs["font_size"])


class PlacementsSerializer(serializers.Serializer):
    """{"first": placement | null, "odd": ..., "even": ...}; missing means none."""

    first = PlacementSerializer(required=False, allow_null=True)
    odd = PlacementSerializer(required=False, allow_null=True)
    even = PlacementSerializer(required=False, allow_null=True)

    def to_internal_value(self, data):
        if isinstance(data, dict):
            unknown = sorted(set(data) - {role.value for role in PageRole})
            if unknown:
                raise serializers.ValidationError(
                    f"Unknown page role(s): {', '.join(unknown)}. Use first, odd or even."
                )
        return super().to_internal_value(data)

    def validate(self, attrs) -> dict[PageRole, Placement]:
        return {PageRole(role): p for role, p in attrs.items() if p is not None}


class NumberFormatSerializer(serializers.Serializer):
    prefix = serializers.CharField(
        allow_blank=True, trim_whitespace=False, max_length=MAX_AFFIX_LENGTH, default=""
    )
    digits = serializers.IntegerField(min_value=1, max_value=MAX_DIGITS, default=4)
    suffix = serializers.CharField(
        allow_blank=True, trim_whitespace=False, max_length=MAX_AFFIX_LENGTH, default=""
    )

    def validate_prefix(self, value: str) -> str:
        return _printable(value)

    def validate_suffix(self, value: str) -> str:
        return _printable(value)

    def validate(self, attrs) -> NumberFormat:
        return NumberFormat(attrs["prefix"], attrs["digits"], attrs["suffix"])


class ConfigSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=MAX_NAME_LENGTH)
    number_format = NumberFormatSerializer(required=False)
    placements = PlacementsSerializer()

    def validate_name(self, value: str) -> str:
        return _printable(value)

    def validate(self, attrs) -> dict:
        config = StampConfig(
            placements=attrs["placements"],
            number_format=attrs.get("number_format", NumberFormat()),
        )
        self._check_characters(config)
        return {"name": attrs["name"], "stamp_config": config}

    @staticmethod
    def _check_characters(config: StampConfig) -> None:
        errors: dict[str, list[str]] = {}
        fmt = config.number_format
        for font_id, missing in sorted(config.unsupported_characters().items()):
            label = get_font(font_id).label
            for field, text in (("prefix", fmt.prefix), ("suffix", fmt.suffix)):
                chars = "".join(sorted(set(text) & missing))
                if chars:
                    errors.setdefault(field, []).append(
                        f"{label} cannot print these characters: {chars}"
                    )
        if errors:
            raise serializers.ValidationError({"number_format": errors})


def config_payload(config: NumberingConfig) -> dict:
    placements = {p.role: p for p in config.placements.all()}
    return {
        "id": str(config.id),
        "name": config.name,
        "version": config.version,
        "created_at": config.created_at.isoformat(),
        "number_format": {
            "prefix": config.prefix,
            "digits": config.digits,
            "suffix": config.suffix,
        },
        "placements": {
            role.value: (
                {"x": p.x, "y": p.y, "font": p.font, "font_size": p.font_size}
                if (p := placements.get(role.value))
                else None
            )
            for role in PageRole
        },
    }
