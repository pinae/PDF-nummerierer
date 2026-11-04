import pytest


@pytest.fixture
def config_payload():
    """The original config.json, in API form."""
    return {
        "name": "HCI Exam SoSe 2026",
        "number_format": {"prefix": "", "digits": 4, "suffix": ""},
        "placements": {
            "first": {"x": 227, "y": 661, "font": "cmu-serif", "font_size": 12},
            "odd": {"x": 144, "y": 780, "font": "cmu-serif", "font_size": 12},
        },
    }


@pytest.fixture
def post_config(client):
    def _post(payload, using=None):
        return (using or client).post("/api/configs/", payload, content_type="application/json")

    return _post
