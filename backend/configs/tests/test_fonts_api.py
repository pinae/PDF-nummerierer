from stamping import FONTS


def test_font_list_for_the_picker(client):
    response = client.get("/api/fonts/")

    assert response.status_code == 200
    fonts = response.json()
    assert [f["id"] for f in fonts] == [f.id for f in FONTS]
    assert fonts[0] == {
        "id": "cmu-serif",
        "label": "Computer Modern Roman",
        "category": "serif",
        "url": "/api/fonts/cmu-serif.ttf",
    }


def test_font_files_are_served_for_the_preview(client):
    response = client.get("/api/fonts/caveat.ttf")

    assert response.status_code == 200
    assert response["Content-Type"] == "font/ttf"
    assert "public" in response["Cache-Control"]
    assert b"".join(response.streaming_content) == FONTS[6].path.read_bytes()


def test_only_registered_fonts_are_served(client):
    assert client.get("/api/fonts/no-such-font.ttf").status_code == 404
    assert client.get("/api/fonts/..%2Fsettings.ttf").status_code == 404
