"""Saving under an existing name creates a new version and never changes old ones."""

import pytest
from django.db import IntegrityError

from configs import services
from configs.models import NumberingConfig
from stamping import NumberFormat, PageRole, Placement, StampConfig

pytestmark = pytest.mark.django_db

FIRST = Placement(227, 661, "cmu-serif", 12)
ODD = Placement(144, 780, "cmu-serif", 12)


DEFAULT_FORMAT = NumberFormat()


def save(name="HCI Exam", placements=None, number_format=DEFAULT_FORMAT):
    placements = {PageRole.FIRST: FIRST} if placements is None else placements
    return services.save_config(name, StampConfig(placements, number_format))


def test_first_save_creates_version_1():
    result = save()

    assert result.created
    assert result.config.version == 1
    assert result.config.name == "HCI Exam"


def test_saving_the_same_name_creates_version_2_and_keeps_version_1():
    v1 = save().config

    v2 = save(placements={PageRole.FIRST: FIRST, PageRole.ODD: ODD}).config

    assert v2.version == 2
    assert v2.pk != v1.pk
    v1.refresh_from_db()
    assert v1.to_stamp_config() == StampConfig({PageRole.FIRST: FIRST})
    assert v2.to_stamp_config() == StampConfig({PageRole.FIRST: FIRST, PageRole.ODD: ODD})


def test_names_match_ignoring_case_and_extra_spaces():
    save("HCI  Exam ")

    result = save(" hci exam", placements={PageRole.ODD: ODD})

    assert result.config.version == 2
    assert result.config.name == "hci exam"


def test_whitespace_in_names_is_normalized():
    assert save("  Final \t exam  ").config.name == "Final exam"


def test_saving_unchanged_content_does_not_create_a_version():
    v1 = save().config

    result = save()

    assert not result.created
    assert result.config.pk == v1.pk
    assert NumberingConfig.objects.count() == 1


def test_restoring_an_older_version_creates_a_new_one():
    save()
    save(placements={PageRole.ODD: ODD})

    result = save()

    assert result.created
    assert result.config.version == 3


def test_number_format_is_part_of_the_content():
    save()

    result = save(number_format=NumberFormat(prefix="A-", digits=3, suffix="!"))

    assert result.config.version == 2
    assert result.config.to_stamp_config().number_format == NumberFormat("A-", 3, "!")


def test_configs_without_placements_can_be_saved():
    assert save(placements={}).config.to_stamp_config().placements == {}


def test_saved_versions_cannot_be_modified():
    config = save().config
    config.name = "Something else"

    with pytest.raises(TypeError, match="immutable"):
        config.save()


def test_latest_versions_lists_one_entry_per_name_sorted_by_name():
    save("b exam")
    save("A exam")
    latest_b = save("B Exam", placements={PageRole.ODD: ODD}).config

    latest = list(NumberingConfig.objects.latest_versions())

    assert [(c.name, c.version) for c in latest] == [("A exam", 1), ("B Exam", 2)]
    assert latest[1].pk == latest_b.pk


def test_versions_of_lists_all_versions_newest_first():
    v1 = save().config
    save("other")
    v2 = save(placements={PageRole.ODD: ODD}).config

    assert list(NumberingConfig.objects.versions_of(v1)) == [v2, v1]


def test_a_concurrent_save_of_the_same_version_is_retried(monkeypatch):
    save()
    real_next_version = services._next_version
    calls = []

    def racing_next_version(name_key):
        calls.append(name_key)
        return 1 if len(calls) == 1 else real_next_version(name_key)

    monkeypatch.setattr(services, "_next_version", racing_next_version)

    result = save(placements={PageRole.ODD: ODD})

    assert result.config.version == 2
    assert len(calls) == 2


def test_version_numbers_are_unique_per_name():
    config = save().config

    with pytest.raises(IntegrityError):
        NumberingConfig.objects.create(
            name="HCI Exam", name_key=config.name_key, version=1, prefix="", digits=4, suffix=""
        )
