"""Docker healthcheck: GET /api/health/ with a Host header Django accepts.

The request always goes straight to the local server: proxy settings from the
environment (HTTP_PROXY and friends, common on university and corporate
servers) would otherwise send it to the proxy and mark a healthy app unhealthy.
"""

import os
import sys
import urllib.request

host = os.environ.get("PDFNUM_ALLOWED_HOSTS", "localhost").split(",")[0].strip() or "localhost"
request = urllib.request.Request("http://127.0.0.1:8000/api/health/", headers={"Host": host})
direct = urllib.request.build_opener(urllib.request.ProxyHandler({}))
try:
    with direct.open(request, timeout=4) as response:
        sys.exit(0 if response.status == 200 else 1)
except OSError:
    sys.exit(1)
