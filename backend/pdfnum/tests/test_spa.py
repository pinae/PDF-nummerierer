"""In production Django serves the built frontend (WhiteNoise) and the app shell."""

import pytest


@pytest.fixture
def frontend(settings, tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "pdfjs" / "cmaps").mkdir(parents=True)
    (tmp_path / "index.html").write_text("<!doctype html><title>PDF-Nummerierer</title>")
    (tmp_path / "assets" / "index-Dswkl-cV.js").write_text("console.log('app')")
    (tmp_path / "pdfjs" / "cmaps" / "Adobe-Japan1-0.bcmap").write_bytes(b"cmap")
    settings.PDFNUM_FRONTEND_DIR = tmp_path
    settings.WHITENOISE_ROOT = tmp_path
    return tmp_path


@pytest.mark.parametrize("path", ["/", "/exams/0f5c6a1e-0000-4000-8000-000000000000", "/done"])
def test_app_routes_get_the_app_shell(client, frontend, path):
    response = client.get(path)

    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/html")
    assert b"<title>PDF-Nummerierer</title>" in response.content
    assert response["Cache-Control"] == "no-cache"


def test_app_shell_has_a_strict_content_security_policy(client, frontend):
    policy = client.get("/")["Content-Security-Policy"]

    for directive in (
        "default-src 'self'",
        "script-src 'self' 'wasm-unsafe-eval'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ):
        assert directive in policy
    assert "unsafe-eval'" not in policy.replace("wasm-unsafe-eval'", "")


def test_hashed_assets_are_cached_forever(client, frontend):
    response = client.get("/assets/index-Dswkl-cV.js")

    assert response.status_code == 200
    assert b"".join(response.streaming_content) == b"console.log('app')"
    assert "immutable" in response["Cache-Control"]


def test_pdfjs_resources_are_served(client, frontend):
    response = client.get("/pdfjs/cmaps/Adobe-Japan1-0.bcmap")

    assert response.status_code == 200


def test_index_html_requested_directly_gets_the_same_headers(client, frontend):
    response = client.get("/index.html")

    assert "frame-ancestors 'none'" in response["Content-Security-Policy"]
    assert "no-cache" in response["Cache-Control"]


def test_unknown_api_paths_are_not_answered_with_the_app(client, frontend):
    response = client.get("/api/does-not-exist/")

    assert response.status_code == 404
    assert b"PDF-Nummerierer" not in response.content


def test_the_app_shell_cannot_be_posted_to(client, frontend):
    assert client.post("/exams/x").status_code == 405


def test_missing_frontend_build_is_explained(client, settings, tmp_path):
    settings.PDFNUM_FRONTEND_DIR = tmp_path / "missing"

    response = client.get("/")

    assert response.status_code == 503
    assert b"make build" in response.content
