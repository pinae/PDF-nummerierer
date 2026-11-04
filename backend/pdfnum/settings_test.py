"""Settings for the pytest suite: production defaults plus a throwaway secret key."""

import os

os.environ.setdefault("PDFNUM_SECRET_KEY", "test-only-insecure-secret-key")
# Jobs run synchronously when the request commits; test_thread_runner covers threads.
os.environ.setdefault("PDFNUM_GENERATION_RUNNER", "immediate")

from .settings import *  # noqa: F403
