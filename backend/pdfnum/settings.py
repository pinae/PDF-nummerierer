"""Django settings for PDF-Nummerierer.

All deployment-specific values come from PDFNUM_* environment variables
(documented in README.md). Defaults are safe for production; development
opts into DEBUG explicitly with PDFNUM_DEBUG=1.
"""

from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .env import env_bool, env_choice, env_int, env_list, env_str

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = env_bool("PDFNUM_DEBUG", default=False)

SECRET_KEY = env_str("PDFNUM_SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("PDFNUM_SECRET_KEY must be set when PDFNUM_DEBUG is off.")
    SECRET_KEY = "django-insecure-development-only-key"  # noqa: S105

ALLOWED_HOSTS = env_list("PDFNUM_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

DATA_DIR = Path(env_str("PDFNUM_DATA_DIR") or BASE_DIR / "var")
DATA_DIR.mkdir(parents=True, exist_ok=True)

# --- Limits -------------------------------------------------------------------
PDFNUM_MAX_UPLOAD_BYTES = env_int("PDFNUM_MAX_UPLOAD_BYTES", 500 * 1024 * 1024)
# Uploaded and generated PDFs are deleted at the latest after this time.
PDFNUM_RETENTION_SECONDS = env_int("PDFNUM_RETENTION_SECONDS", 2 * 60 * 60)
PDFNUM_UPLOAD_RATE = env_str("PDFNUM_UPLOAD_RATE", "60/hour")
PDFNUM_CONFIG_SAVE_RATE = env_str("PDFNUM_CONFIG_SAVE_RATE", "60/hour")
PDFNUM_MAX_COPIES = env_int("PDFNUM_MAX_COPIES", 9999)
# Protects memory: the output is assembled in memory before it is written.
PDFNUM_MAX_OUTPUT_PAGES = env_int("PDFNUM_MAX_OUTPUT_PAGES", 100_000)
PDFNUM_GENERATION_WORKERS = env_int("PDFNUM_GENERATION_WORKERS", 2)
PDFNUM_GENERATION_RUNNER = env_choice("PDFNUM_GENERATION_RUNNER", "thread", {"thread", "immediate"})
# Running jobs without progress for this long are marked as interrupted.
PDFNUM_JOB_TIMEOUT_SECONDS = env_int("PDFNUM_JOB_TIMEOUT_SECONDS", 30 * 60)

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.staticfiles",
    "rest_framework",
    "documents",
    "configs",
    "generation",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "pdfnum.middleware.RequestSizeLimitMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "pdfnum.urls"
WSGI_APPLICATION = "pdfnum.wsgi.application"
ASGI_APPLICATION = "pdfnum.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": ["django.template.context_processors.request"]},
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": DATA_DIR / "db.sqlite3",
        # The generation worker thread writes progress while requests are served.
        "OPTIONS": {
            "init_command": "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;",
            "transaction_mode": "IMMEDIATE",
            "timeout": 20,
        },
    }
}

# Uploaded exams are private: MEDIA_URL is deliberately not routed anywhere,
# files are only ever streamed by views that check the owner.
MEDIA_ROOT = DATA_DIR / "media"
MEDIA_URL = ""
FILE_UPLOAD_PERMISSIONS = 0o600
FILE_UPLOAD_DIRECTORY_PERMISSIONS = 0o700
FILE_UPLOAD_TEMP_DIR = DATA_DIR / "tmp"
FILE_UPLOAD_TEMP_DIR.mkdir(exist_ok=True)
STATIC_URL = "static/"
STATIC_ROOT = DATA_DIR / "static"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Security -----------------------------------------------------------------
# There is no login: an uploaded exam is protected only by the session it was
# uploaded in, so the session cookie must never leak to scripts or other sites.
SECURE_COOKIES = env_bool("PDFNUM_SECURE_COOKIES", default=not DEBUG)

SESSION_COOKIE_SECURE = SECURE_COOKIES
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = PDFNUM_RETENTION_SECONDS

CSRF_COOKIE_SECURE = SECURE_COOKIES
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False

X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"

# --- API ----------------------------------------------------------------------
REST_FRAMEWORK = {
    # Nobody logs in, but CSRF must still be enforced (see pdfnum/api.py).
    "DEFAULT_AUTHENTICATION_CLASSES": ["pdfnum.api.CsrfEnforcingAnonymousAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": [],
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "EXCEPTION_HANDLER": "pdfnum.api.exception_handler",
}
