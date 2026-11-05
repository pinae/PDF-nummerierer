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
    "PDFNUM_UPLOAD_RATE",
    "PDFNUM_CONFIG_SAVE_RATE",
    "PDFNUM_JOB_TIMEOUT_SECONDS",
    "PDFNUM_FRONTEND_DIR",
    "PDFNUM_IDLE_SECONDS",
    "PDFNUM_CSRF_TRUSTED_ORIGINS",
    "PDFNUM_HSTS_SECONDS",
    "PDFNUM_TRUST_PROXY",
    "PDFNUM_GENERATION_RUNNER",
    "PDFNUM_GENERATION_WORKERS",
    "PDFNUM_MAX_OUTPUT_PAGES",
    "PDFNUM_MAX_COPIES",
    "PDFNUM_RETENTION_SECONDS",
    "PDFNUM_MAX_UPLOAD_BYTES",
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


def test_upload_limit_defaults_to_500_megabytes(load_settings):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50)

    assert settings.PDFNUM_MAX_UPLOAD_BYTES == 500 * 1024 * 1024


def test_retention_defaults_to_two_hours_and_bounds_the_session(load_settings):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50)

    assert settings.PDFNUM_RETENTION_SECONDS == 2 * 60 * 60
    assert settings.SESSION_COOKIE_AGE == settings.PDFNUM_RETENTION_SECONDS


def test_limits_can_be_configured(load_settings):
    settings = load_settings(
        PDFNUM_SECRET_KEY="x" * 50,
        PDFNUM_MAX_UPLOAD_BYTES="1000",
        PDFNUM_RETENTION_SECONDS="60",
        PDFNUM_UPLOAD_RATE="5/minute",
    )

    assert settings.PDFNUM_MAX_UPLOAD_BYTES == 1000
    assert settings.PDFNUM_RETENTION_SECONDS == 60
    assert settings.PDFNUM_UPLOAD_RATE == "5/minute"


@pytest.mark.parametrize("raw", ["0", "-5", "lots"])
def test_invalid_limits_are_rejected(load_settings, raw):
    with pytest.raises(ImproperlyConfigured, match="PDFNUM_MAX_UPLOAD_BYTES"):
        load_settings(PDFNUM_SECRET_KEY="x" * 50, PDFNUM_MAX_UPLOAD_BYTES=raw)


def test_uploaded_files_are_private_to_the_server_user(load_settings, tmp_path):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50, PDFNUM_DATA_DIR=str(tmp_path))

    assert settings.FILE_UPLOAD_PERMISSIONS == 0o600
    assert settings.FILE_UPLOAD_DIRECTORY_PERMISSIONS == 0o700
    assert Path(settings.FILE_UPLOAD_TEMP_DIR) == tmp_path / "tmp"
    assert (tmp_path / "tmp").is_dir()


def test_media_is_never_given_a_public_url(load_settings):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50)

    assert settings.MEDIA_URL in ("", "/")


def test_config_save_rate(load_settings):
    assert load_settings(PDFNUM_SECRET_KEY="x" * 50).PDFNUM_CONFIG_SAVE_RATE == "60/hour"
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50, PDFNUM_CONFIG_SAVE_RATE="3/minute")
    assert settings.PDFNUM_CONFIG_SAVE_RATE == "3/minute"


def test_generation_limits(load_settings):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50)

    assert settings.PDFNUM_MAX_COPIES == 9999
    assert settings.PDFNUM_MAX_OUTPUT_PAGES == 100_000
    assert settings.PDFNUM_GENERATION_WORKERS == 2
    assert settings.PDFNUM_GENERATION_RUNNER == "thread"
    assert settings.PDFNUM_JOB_TIMEOUT_SECONDS == 30 * 60


def test_unknown_generation_runner_is_rejected(load_settings):
    with pytest.raises(ImproperlyConfigured, match="PDFNUM_GENERATION_RUNNER"):
        load_settings(PDFNUM_SECRET_KEY="x" * 50, PDFNUM_GENERATION_RUNNER="celery")


def test_sqlite_is_tuned_for_a_background_worker(load_settings):
    options = load_settings(PDFNUM_SECRET_KEY="x" * 50).DATABASES["default"]["OPTIONS"]

    assert "journal_mode=WAL" in options["init_command"]
    assert options["transaction_mode"] == "IMMEDIATE"
    assert options["timeout"] >= 20


def test_forwarding_headers_are_ignored_by_default(load_settings):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50)

    assert getattr(settings, "SECURE_PROXY_SSL_HEADER", None) is None
    # 0: the client IP is REMOTE_ADDR; a spoofed X-Forwarded-For is ignored.
    assert settings.REST_FRAMEWORK["NUM_PROXIES"] == 0


def test_behind_traefik_the_forwarded_proto_and_client_ip_are_trusted(load_settings):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50, PDFNUM_TRUST_PROXY="1")

    assert settings.SECURE_PROXY_SSL_HEADER == ("HTTP_X_FORWARDED_PROTO", "https")
    assert settings.REST_FRAMEWORK["NUM_PROXIES"] == 1


def test_hsts_and_trusted_origins_are_configurable(load_settings):
    settings = load_settings(
        PDFNUM_SECRET_KEY="x" * 50,
        PDFNUM_HSTS_SECONDS="31536000",
        PDFNUM_CSRF_TRUSTED_ORIGINS="https://exams.example.org",
    )

    assert settings.SECURE_HSTS_SECONDS == 31536000
    assert settings.CSRF_TRUSTED_ORIGINS == ["https://exams.example.org"]


def test_hsts_is_off_unless_configured(load_settings):
    # HSTS cannot be undone in browsers, so the operator switches it on explicitly.
    assert load_settings(PDFNUM_SECRET_KEY="x" * 50).SECURE_HSTS_SECONDS == 0


def test_throttling_cache_is_shared_between_worker_processes(load_settings, tmp_path):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50, PDFNUM_DATA_DIR=str(tmp_path))

    cache = settings.CACHES["default"]
    assert cache["BACKEND"] == "django.core.cache.backends.filebased.FileBasedCache"
    assert Path(cache["LOCATION"]) == tmp_path / "cache"


def test_logs_go_to_the_console(load_settings):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50)

    assert settings.LOGGING["root"]["handlers"] == ["console"]


def test_frontend_build_is_served_from_the_configured_directory(load_settings, tmp_path):
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50, PDFNUM_FRONTEND_DIR=str(tmp_path))

    assert Path(settings.PDFNUM_FRONTEND_DIR) == tmp_path
    assert Path(settings.WHITENOISE_ROOT) == tmp_path
    assert "whitenoise.middleware.WhiteNoiseMiddleware" in settings.MIDDLEWARE


def test_abandoned_uploads_are_deleted_after_15_idle_minutes_by_default(load_settings):
    assert load_settings(PDFNUM_SECRET_KEY="x" * 50).PDFNUM_IDLE_SECONDS == 15 * 60
    settings = load_settings(PDFNUM_SECRET_KEY="x" * 50, PDFNUM_IDLE_SECONDS="300")
    assert settings.PDFNUM_IDLE_SECONDS == 300
