from django.conf import settings
from rest_framework import serializers

from configs.serializers import StampConfigSerializer

MAX_START = 999_999_999


class GenerateSerializer(StampConfigSerializer):
    copies = serializers.IntegerField(min_value=1)
    start = serializers.IntegerField(min_value=0, max_value=MAX_START, default=1)
    pad_to_even = serializers.BooleanField(default=True)

    def validate_copies(self, value: int) -> int:
        if value > settings.PDFNUM_MAX_COPIES:
            raise serializers.ValidationError(
                f"At most {settings.PDFNUM_MAX_COPIES} copies can be generated at once."
            )
        return value

    def validate(self, attrs) -> dict:
        return {
            "stamp_config": self.stamp_config(attrs),
            "copies": attrs["copies"],
            "start": attrs["start"],
            "pad_to_even": attrs["pad_to_even"],
        }
