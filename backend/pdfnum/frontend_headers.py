"""Headers for the built frontend (imported by the settings, so no Django imports)."""

# The SPA only talks to its own origin. Emotion injects <style> elements
# (hence 'unsafe-inline' for styles only); pdf.js compiles its image decoders
# to WebAssembly (hence 'wasm-unsafe-eval', which does not allow eval()).
CONTENT_SECURITY_POLICY = "; ".join(
    [
        "default-src 'self'",
        "script-src 'self' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "worker-src 'self' blob:",
        "connect-src 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ]
)


def add_html_headers(headers, path: str, url: str) -> None:
    """WhiteNoise hook: the app shell is never cached and always gets the CSP."""
    if path.endswith(".html"):
        headers["Cache-Control"] = "no-cache"
        headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY


def is_immutable(path: str, url: str) -> bool:
    """Vite puts a content hash into every file name under /assets/."""
    return url.startswith("/assets/")
