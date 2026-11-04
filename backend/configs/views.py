from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from pdfnum.api import ConfigSaveRateThrottle
from stamping import FONTS, UnknownFontError, get_font

from .models import NumberingConfig
from .serializers import ConfigSerializer, config_payload
from .services import save_config

FONT_CACHE_SECONDS = 24 * 60 * 60


class ConfigCollectionView(APIView):
    def get_throttles(self):
        return [ConfigSaveRateThrottle()] if self.request.method == "POST" else []

    def get(self, request):
        return Response([config_payload(c) for c in NumberingConfig.objects.latest_versions()])

    def post(self, request):
        serializer = ConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = save_config(**serializer.validated_data)
        return Response(
            config_payload(result.config),
            status=status.HTTP_201_CREATED if result.created else status.HTTP_200_OK,
        )


class ConfigDetailView(APIView):
    def get(self, request, config_id):
        return Response(config_payload(get_object_or_404(NumberingConfig, pk=config_id)))


class ConfigVersionsView(APIView):
    def get(self, request, config_id):
        config = get_object_or_404(NumberingConfig, pk=config_id)
        return Response([config_payload(c) for c in NumberingConfig.objects.versions_of(config)])


class FontListView(APIView):
    def get(self, request):
        return Response(
            [
                {
                    "id": font.id,
                    "label": font.label,
                    "category": font.category.value,
                    "url": f"/api/fonts/{font.id}.ttf",
                }
                for font in FONTS
            ]
        )


class FontFileView(APIView):
    """The same TTF files the PDF output uses, for the browser preview."""

    def get(self, request, font_id):
        try:
            font = get_font(font_id)
        except UnknownFontError:
            raise Http404 from None
        response = FileResponse(font.path.open("rb"), content_type="font/ttf")
        response["Cache-Control"] = f"public, max-age={FONT_CACHE_SECONDS}"
        return response
