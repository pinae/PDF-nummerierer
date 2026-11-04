"""Render-based checks: the stamp must appear exactly where it was placed, as the
user sees the page, and everything else must look like the original."""

import io

import pytest

from stamping import PageRole, Placement, StampConfig, generate_copies
from stamping.fonts import string_width

from .pdfs import A4, PageSpec, landscape_a5, make_pdf
from .render import ink_box, render, same_rendering

FONT, SIZE, TEXT = "dejavu-sans", 20, "0001"
TOLERANCE = 2.0  # points: side bearings, overshoot and anti-aliasing


def stamped(pdf: bytes, placements: dict[PageRole, Placement]) -> bytes:
    out = io.BytesIO()
    generate_copies(io.BytesIO(pdf), out, StampConfig(placements=placements), copies=1)
    return out.getvalue()


def assert_text_at(box, x: float, y: float) -> None:
    width = string_width(FONT, TEXT, SIZE)
    assert box is not None, "no stamp visible"
    assert box.left == pytest.approx(x, abs=TOLERANCE)
    assert box.bottom == pytest.approx(y, abs=TOLERANCE)
    assert box.right == pytest.approx(x + width, abs=2 * TOLERANCE)
    assert box.top - box.bottom < SIZE, "text must run horizontally as displayed"


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_stamp_lands_at_the_displayed_position(rotation):
    pdf = make_pdf(PageSpec(size=(300, 400), rotate=rotation, cropbox=(20, 30, 280, 380)))

    output = stamped(pdf, {PageRole.FIRST: Placement(50, 60, FONT, SIZE)})

    assert_text_at(ink_box(render(output, 0)), 50, 60)


def test_each_page_size_uses_its_own_corner():
    pdf = make_pdf(PageSpec(size=A4), PageSpec(size=landscape_a5()), PageSpec(size=(200, 200)))
    placement = Placement(30, 40, FONT, SIZE)

    output = stamped(pdf, {role: placement for role in PageRole})

    for page_index in range(3):
        assert_text_at(ink_box(render(output, page_index)), 30, 40)


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_pages_without_stamp_render_exactly_like_the_original(rotation):
    pdf = make_pdf(
        PageSpec(text="Question 1: Explain usability.", rotate=rotation, image_bytes=3000),
        PageSpec(text="Question 2", size=landscape_a5(), cropbox=(10, 10, 500, 400)),
    )

    output = stamped(pdf, {})

    for page_index in range(2):
        assert same_rendering(render(output, page_index), render(pdf, page_index))


def test_original_config_positions():
    """Page 1 at (227, 661) and odd pages at (144, 780), as in config.json."""
    pdf = make_pdf(PageSpec(), PageSpec(), PageSpec())

    output = stamped(
        pdf,
        {
            PageRole.FIRST: Placement(227, 661, FONT, SIZE),
            PageRole.ODD: Placement(144, 780, FONT, SIZE),
        },
    )

    assert_text_at(ink_box(render(output, 0)), 227, 661)
    assert ink_box(render(output, 1)) is None
    assert_text_at(ink_box(render(output, 2)), 144, 780)
    assert A4[1] > 780
