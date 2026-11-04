import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _isolated_media(settings, tmp_path):
    """Every test stores uploads in its own temporary directory."""
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.FILE_UPLOAD_TEMP_DIR = None


@pytest.fixture(autouse=True)
def _fresh_cache():
    """Throttling state must not leak between tests."""
    cache.clear()
    yield
    cache.clear()
