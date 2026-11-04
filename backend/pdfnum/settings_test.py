"""Settings for the pytest suite: production defaults plus a throwaway secret key."""

import os

os.environ.setdefault("PDFNUM_SECRET_KEY", "test-only-insecure-secret-key")

from .settings import *  # noqa: F403
