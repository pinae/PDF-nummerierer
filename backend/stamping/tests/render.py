"""Render pages with PDFium (independent of pypdf/reportlab) to check what a
printer would actually put on paper."""

from dataclasses import dataclass

import pypdfium2 as pdfium
from PIL import Image, ImageChops

SCALE = 4  # pixels per PDF point


@dataclass(frozen=True)
class InkBox:
    """Bounding box of dark pixels in displayed page coordinates (points, y up)."""

    left: float
    bottom: float
    right: float
    top: float


def render(pdf: bytes, page_index: int) -> Image.Image:
    document = pdfium.PdfDocument(pdf)
    try:
        return document[page_index].render(scale=SCALE, may_draw_forms=False).to_pil()
    finally:
        document.close()


def ink_box(
    image: Image.Image, region: tuple[float, float, float, float] | None = None
) -> InkBox | None:
    """Dark-pixel bounding box, optionally only inside region (l, b, r, t in points)."""
    height_pt = image.height / SCALE
    mask = image.convert("L").point(lambda v: 255 if v < 128 else 0)
    if region:
        left, bottom, right, top = region
        crop = (
            round(left * SCALE),
            round((height_pt - top) * SCALE),
            round(right * SCALE),
            round((height_pt - bottom) * SCALE),
        )
        box = mask.crop(crop).getbbox()
        if box is None:
            return None
        box = (box[0] + crop[0], box[1] + crop[1], box[2] + crop[0], box[3] + crop[1])
    else:
        box = mask.getbbox()
        if box is None:
            return None
    x0, y0, x1, y1 = box
    return InkBox(x0 / SCALE, height_pt - y1 / SCALE, x1 / SCALE, height_pt - y0 / SCALE)


def same_rendering(a: Image.Image, b: Image.Image) -> bool:
    return a.size == b.size and ImageChops.difference(a, b).getbbox() is None
