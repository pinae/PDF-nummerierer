"""Coordinates are measured from the bottom-left corner of the page *as displayed*
(crop box, after /Rotate), x to the right and y upwards, in PDF points."""

import io

import pytest
from pypdf import PdfReader

from stamping.geometry import PageGeometry, inspect_pdf

from .pdfs import A4, PageSpec, make_pdf

BOX = (10.0, 20.0, 110.0, 220.0)  # 100 wide, 200 high, offset origin


def geometry(rotation: int) -> PageGeometry:
    return PageGeometry(box=BOX, rotation=rotation)


@pytest.mark.parametrize(
    ("rotation", "size"),
    [(0, (100, 200)), (90, (200, 100)), (180, (100, 200)), (270, (200, 100))],
)
def test_displayed_size_swaps_for_quarter_turns(rotation, size):
    g = geometry(rotation)

    assert (g.width, g.height) == size


@pytest.mark.parametrize(
    ("rotation", "display_point", "user_point"),
    [
        (0, (0, 0), (10, 20)),
        (0, (100, 200), (110, 220)),
        (90, (0, 0), (110, 20)),
        (90, (200, 100), (10, 220)),
        (180, (0, 0), (110, 220)),
        (180, (100, 200), (10, 20)),
        (270, (0, 0), (10, 220)),
        (270, (200, 100), (110, 20)),
    ],
)
def test_display_points_map_to_user_space(rotation, display_point, user_point):
    matrix = geometry(rotation).stamp_matrix(*display_point)

    assert matrix[4:] == pytest.approx(user_point)


@pytest.mark.parametrize(
    ("rotation", "direction"),
    [(0, (1, 0)), (90, (0, 1)), (180, (-1, 0)), (270, (0, -1))],
)
def test_text_runs_left_to_right_as_displayed(rotation, direction):
    a, b, *_ = geometry(rotation).stamp_matrix(0, 0)

    assert (a, b) == pytest.approx(direction)


@pytest.mark.parametrize(("raw", "normalized"), [(-90, 270), (450, 90), (360, 0), (45, 0)])
def test_rotation_is_normalized(raw, normalized):
    assert PageGeometry(box=BOX, rotation=raw).rotation == normalized


def test_crop_box_is_clipped_to_the_media_box():
    pdf = make_pdf(PageSpec(size=(200, 300), cropbox=(-50, 10, 150, 400)))

    (g,) = inspect_pdf(io.BytesIO(pdf))

    assert g.box == (0, 10, 150, 300)


def test_inspect_reports_every_page():
    pdf = make_pdf(PageSpec(), PageSpec(size=(300, 200), rotate=90))

    pages = inspect_pdf(io.BytesIO(pdf))

    assert [(p.width, p.height) for p in pages] == [pytest.approx(A4), (200, 300)]


def test_geometry_from_pypdf_page():
    pdf = make_pdf(PageSpec(size=(200, 300), rotate=270, cropbox=(5, 5, 105, 205)))

    g = PageGeometry.from_page(PdfReader(io.BytesIO(pdf)).pages[0])

    assert g == PageGeometry(box=(5, 5, 105, 205), rotation=270)
