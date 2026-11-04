import copy
import datetime as dt

import pytest
from django.test import Client

pytestmark = pytest.mark.django_db

UNKNOWN = "00000000-0000-4000-8000-000000000000"


def test_save_returns_the_full_config(post_config, config_payload):
    response = post_config(config_payload)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "HCI Exam SoSe 2026"
    assert body["version"] == 1
    assert body["number_format"] == {"prefix": "", "digits": 4, "suffix": ""}
    assert body["placements"] == {
        "first": {"x": 227.0, "y": 661.0, "font": "cmu-serif", "font_size": 12.0},
        "odd": {"x": 144.0, "y": 780.0, "font": "cmu-serif", "font_size": 12.0},
        "even": None,
    }
    dt.datetime.fromisoformat(body["created_at"])


def test_missing_and_null_placements_mean_no_number(post_config, config_payload):
    config_payload["placements"] = {"even": None}

    body = post_config(config_payload).json()

    assert body["placements"] == {"first": None, "odd": None, "even": None}


def test_number_format_defaults_to_four_digits(post_config, config_payload):
    del config_payload["number_format"]

    assert post_config(config_payload).json()["number_format"]["digits"] == 4


def test_saving_again_creates_a_new_version_and_keeps_the_old(client, post_config, config_payload):
    v1 = post_config(config_payload).json()
    changed = copy.deepcopy(config_payload)
    changed["placements"]["first"]["x"] = 300

    v2 = post_config(changed)

    assert v2.status_code == 201
    assert v2.json()["version"] == 2
    assert client.get(f"/api/configs/{v1['id']}/").json() == v1


def test_saving_unchanged_content_returns_the_existing_version(post_config, config_payload):
    v1 = post_config(config_payload).json()

    response = post_config(config_payload)

    assert response.status_code == 200
    assert response.json() == v1


def test_list_shows_the_latest_version_of_each_name(client, post_config, config_payload):
    post_config(config_payload)
    config_payload["placements"]["first"]["x"] = 300
    latest = post_config(config_payload).json()
    other = post_config({**config_payload, "name": "Algorithms exam"}).json()

    response = client.get("/api/configs/")

    assert response.status_code == 200
    assert response.json() == [other, latest]


def test_versions_lists_the_history_newest_first(client, post_config, config_payload):
    v1 = post_config(config_payload).json()
    config_payload["placements"]["first"]["x"] = 300
    v2 = post_config(config_payload).json()

    response = client.get(f"/api/configs/{v1['id']}/versions/")

    assert response.json() == [v2, v1]


def test_configs_are_shared_with_everybody(post_config, config_payload):
    saved = post_config(config_payload).json()
    colleague = Client()

    assert colleague.get("/api/configs/").json() == [saved]
    assert colleague.get(f"/api/configs/{saved['id']}/").json() == saved
    config_payload["placements"]["first"]["x"] = 300
    assert post_config(config_payload, using=colleague).json()["version"] == 2


@pytest.mark.parametrize("path", [f"/api/configs/{UNKNOWN}/", f"/api/configs/{UNKNOWN}/versions/"])
def test_unknown_config(client, path):
    response = client.get(path)

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize("method", ["put", "patch", "delete"])
def test_saved_versions_cannot_be_changed_or_deleted(client, post_config, config_payload, method):
    saved = post_config(config_payload).json()

    response = getattr(client, method)(
        f"/api/configs/{saved['id']}/", config_payload, content_type="application/json"
    )

    assert response.status_code == 405


def invalid(post_config, payload) -> dict:
    response = post_config(payload)
    assert response.status_code == 400, response.content
    error = response.json()["error"]
    assert error["code"] == "invalid"
    return error["fields"]


@pytest.mark.parametrize(
    ("change", "field"),
    [
        (lambda p: p.pop("name"), "name"),
        (lambda p: p.update(name="   "), "name"),
        (lambda p: p.update(name="x" * 81), "name"),
        (lambda p: p.update(name="two\nlines"), "name"),
        (lambda p: p["placements"].update(back={"x": 1, "y": 1, "font": "caveat"}), "placements"),
        (lambda p: p.update(placements=["first"]), "placements"),
        (lambda p: p["placements"]["first"].update(font="comic-sans"), "placements.first.font"),
        (lambda p: p["placements"]["first"].pop("font"), "placements.first.font"),
        (lambda p: p["placements"]["first"].update(font_size=0), "placements.first.font_size"),
        (lambda p: p["placements"]["first"].update(font_size=201), "placements.first.font_size"),
        (lambda p: p["placements"]["odd"].update(x=-1), "placements.odd.x"),
        (lambda p: p["placements"]["odd"].update(y=14401), "placements.odd.y"),
        (lambda p: p["placements"]["odd"].update(y="high"), "placements.odd.y"),
        (lambda p: p["number_format"].update(digits=0), "number_format.digits"),
        (lambda p: p["number_format"].update(digits=13), "number_format.digits"),
        (lambda p: p["number_format"].update(prefix="x" * 41), "number_format.prefix"),
        (lambda p: p["number_format"].update(suffix="\t"), "number_format.suffix"),
    ],
)
def test_invalid_configs_are_rejected_with_the_offending_field(
    post_config, config_payload, change, field
):
    change(config_payload)

    fields = invalid(post_config, config_payload)

    assert field in fields
    assert all(isinstance(message, str) for messages in fields.values() for message in messages)


def test_characters_the_font_cannot_print_are_rejected(post_config, config_payload):
    config_payload["number_format"]["prefix"] = "中 "

    fields = invalid(post_config, config_payload)

    assert "Computer Modern Roman" in fields["number_format.prefix"][0]


def test_saving_is_throttled(post_config, config_payload, settings):
    settings.PDFNUM_CONFIG_SAVE_RATE = "2/minute"
    statuses = []
    for x in (1, 2, 3):
        config_payload["placements"]["first"]["x"] = x
        statuses.append(post_config(config_payload).status_code)

    assert statuses == [201, 201, 429]


def test_reading_is_not_throttled(client, post_config, config_payload, settings):
    settings.PDFNUM_CONFIG_SAVE_RATE = "1/minute"
    saved = post_config(config_payload).json()

    assert all(client.get(f"/api/configs/{saved['id']}/").status_code == 200 for _ in range(5))
