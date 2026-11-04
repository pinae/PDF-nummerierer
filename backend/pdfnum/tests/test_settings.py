"""Settings are read from environment variables; security defaults must hold in production."""

import importlib
from pathlib import Path

import pytest
from django.core.exceptions import ImproperlyConfigured

ENV_VARS = [
    "PDFNUM_DEBUG",
    "PDFNUM_SECRET_KEY",
    "PDFNUM_ALLOWED_HOSTS",
    "PDFNUM_DATA_DIR",
    "PDFNUM_SECURE_COOKIES",
]


@pytest.fixture
def load_settings(monkeypatch):
    """Import a fresh copy of pdfnum.settings under a controlled environment."""
    for name in ENV_VARS:
        monkeypatch.delenv(name, raising=False)

    def _load(**env):
        for key, value in env.items():
            monkeypatch.setenv(key, value)
        import pdfnum.settings as module

        return importlib.reload(module)

    yield _load

    monkeypatch.undo()
    import pdfnum.settings as module

    importlib.reload(module)


def test_production_requires_a_secret_key(load_settings):
    with pytest.raises(ImproperlyConfigured, match="PDFNUM_SECRET_KEY"):
        load_settings()


def test_debug_is_off_by_default(load_settings):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50)

    assert settings.DEBUG is False


def test_debug_mode_works_without_secret_key(load_settings):
    settings = load_settings(PDFNUM_DEBUG="1")

    assert settings.DEBUG is True
    assert settings.SECRET_KEY


def test_cookies_are_hardened_in_production(load_settings):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50)

    assert settings.SESSION_COOKIE_SECURE is True
    assert settings.SESSION_COOKIE_HTTPONLY is True
    assert settings.SESSION_COOKIE_SAMESITE == "Lax"
    assert settings.CSRF_COOKIE_SECURE is True
    assert settings.CSRF_COOKIE_SAMESITE == "Lax"
    # The SPA must read the CSRF token to echo it in the X-CSRFToken header.
    assert settings.CSRF_COOKIE_HTTPONLY is False


def test_secure_cookies_can_be_disabled_explicitly(load_settings):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50, PDFNUM_SECURE_COOKIES="0")

    assert settings.SESSION_COOKIE_SECURE is False
    assert settings.CSRF_COOKIE_SECURE is False


def test_security_headers(load_settings):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50)

    assert settings.X_FRAME_OPTIONS == "DENY"
    assert settings.SECURE_CONTENT_TYPE_NOSNIFF is True
    assert settings.SECURE_REFERRER_POLICY == "same-origin"


def test_allowed_hosts_from_comma_separated_env(load_settings):
    settings = load_settings(
        PDFNUM_SECRET_KEY="x" * 50, PDFNUM_ALLOWED_HOSTS="exam.example.org, localhost"
    )

    assert settings.ALLOWED_HOSTS == ["exam.example.org", "localhost"]


def test_data_dir_holds_database_and_media(load_settings, tmp_path):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50, PDFNUM_DATA_DIR=str(tmp_path))

    assert Path(settings.DATABASES["default"]["NAME"]) == tmp_path / "db.sqlite3"
    assert Path(settings.MEDIA_ROOT) == tmp_path / "media"


@pytest.mark.parametrize("raw", ["yes", "2", "maybe"])
def test_invalid_boolean_env_values_are_rejected(load_settings, raw):
    with pytest.raises(ImproperlyConfigured, match="PDFNUM_DEBUG"):
        load_settings(PDFNUM_DEBUG=raw)


def test_missing_data_dir_is_created(load_settings, tmp_path):
    data_dir = tmp_path / "fresh" / "checkout"

    load_settings(PDFNUM_SECRET_KEY="x" * 50, PDFNUM_DATA_DIR=str(data_dir))

    assert data_dir.is_dir()
