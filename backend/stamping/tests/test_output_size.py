"""With up to 9999 copies of a large exam, the output must not grow with
copies x input size: images, fonts and page content are written once."""

import io

from stamping import PageRole, Placement, StampConfig, generate_copies

from .pdfs import PageSpec, make_pdf

COPIES = 50
PER_PAGE_BUDGET = 1024  # bytes for one numbered page of one additional copy


def test_shared_resources_are_written_once():
    pdf = make_pdf(PageSpec(text="with picture", image_bytes=300_000), PageSpec(text="text"))
    config = StampConfig(
        placements={
            PageRole.FIRST: Placement(50, 50, "caveat", 14),
            PageRole.EVEN: Placement(50, 50, "cmu-serif", 12),
        }
    )
    out = io.BytesIO()

    generate_copies(io.BytesIO(pdf), out, config, copies=COPIES)

    assert len(pdf) > 300_000
    assert len(out.getvalue()) < len(pdf) + COPIES * 2 * PER_PAGE_BUDGET
