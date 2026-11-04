"""Django settings for PDF-Nummerierer.

All deployment-specific values come from PDFNUM_* environment variables
(documented in README.md). Defaults are safe for production; development
opts into DEBUG explicitly with PDFNUM_DEBUG=1.
"""

from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .env import env_bool, env_list, env_str

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

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.staticfiles",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
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
    }
}

MEDIA_ROOT = DATA_DIR / "media"
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

CSRF_COOKIE_SECURE = SECURE_COOKIES
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False

X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
