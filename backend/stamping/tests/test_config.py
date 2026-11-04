import math

import pytest

from stamping.config import PageRole, Placement, StampConfig, role_for_page
from stamping.errors import UnknownFontError
from stamping.numbering import NumberFormat


@pytest.mark.parametrize(
    ("page_number", "role"),
    [
        (1, PageRole.FIRST),
        (2, PageRole.EVEN),
        (3, PageRole.ODD),
        (4, PageRole.EVEN),
        (5, PageRole.ODD),
    ],
)
def test_page_roles_follow_the_original_script(page_number, role):
    assert role_for_page(page_number) is role


def test_page_numbers_start_at_one():
    with pytest.raises(ValueError, match="page"):
        role_for_page(0)


def test_placements_are_optional_per_role():
    config = StampConfig(placements={PageRole.ODD: Placement(144, 780, "cmu-serif", 12)})

    assert config.placement_for_page(1) is None
    assert config.placement_for_page(2) is None
    assert config.placement_for_page(3) == Placement(144, 780, "cmu-serif", 12)


def test_default_number_format():
    assert StampConfig(placements={}).number_format == NumberFormat()


def test_placement_rejects_unknown_fonts():
    with pytest.raises(UnknownFontError):
        Placement(0, 0, "comic-sans", 12)


@pytest.mark.parametrize("size", [0, -3, 201, math.nan])
def test_placement_font_size_is_bounded(size):
    with pytest.raises(ValueError, match="font size"):
        Placement(0, 0, "cmu-serif", size)


@pytest.mark.parametrize(("x", "y"), [(math.inf, 0), (0, math.nan)])
def test_placement_coordinates_must_be_finite(x, y):
    with pytest.raises(ValueError, match="coordinates"):
        Placement(x, y, "cmu-serif", 12)


def test_fonts_in_use_lists_each_font_once():
    config = StampConfig(
        placements={
            PageRole.FIRST: Placement(1, 1, "caveat", 12),
            PageRole.ODD: Placement(1, 1, "caveat", 14),
            PageRole.EVEN: Placement(1, 1, "cmu-serif", 12),
        },
        number_format=NumberFormat(prefix="Nr. "),
    )

    assert config.fonts_in_use() == {"caveat", "cmu-serif"}
