"""Inspection helper for the Playwright tests (run with the backend's uv environment).

    summary <pdf>                         -> {"pages": n, "texts": [...]}
    ink-pdf <pdf> <ref.pdf> <page> <ref-page> <scale>
                                          -> ink box of what <pdf> adds to <ref.pdf>
    ink-png <with.png> <without.png> <page-width-pt>
                                          -> ink box of what <with.png> adds

Ink boxes are [left, bottom, right, top] in PDF points of the page as displayed
(origin bottom-left), or null when nothing differs.
"""

import json
import sys

import pypdfium2 as pdfium
from PIL import Image, ImageChops
from pypdf import PdfReader

THRESHOLD = 64  # ignore anti-aliasing noise


def ink_box(with_ink: Image.Image, without: Image.Image, points_per_pixel: float):
    difference = ImageChops.difference(with_ink.convert("L"), without.convert("L"))
    box = difference.point(lambda value: 255 if value > THRESHOLD else 0).getbbox()
    if box is None:
        return None
    left, top, right, bottom = box
    height = with_ink.height
    return [
        round(left * points_per_pixel, 2),
        round((height - bottom) * points_per_pixel, 2),
        round(right * points_per_pixel, 2),
        round((height - top) * points_per_pixel, 2),
    ]


def render(path: str, index: int, scale: float) -> Image.Image:
    document = pdfium.PdfDocument(path)
    try:
        return document[index].render(scale=scale, may_draw_forms=False).to_pil()
    finally:
        document.close()


def main(command: str, *args: str):
    if command == "summary":
        reader = PdfReader(args[0])
        return {"pages": len(reader.pages), "texts": [page.extract_text() for page in reader.pages]}
    if command == "ink-pdf":
        pdf, reference, page, reference_page, scale = args
        scale = float(scale)
        printed = render(pdf, int(page), scale)
        original = render(reference, int(reference_page), scale)
        return ink_box(printed, original, 1 / scale)
    if command == "ink-png":
        with_path, without_path, page_width_pt = args
        with_ink = Image.open(with_path)
        return ink_box(with_ink, Image.open(without_path), float(page_width_pt) / with_ink.width)
    raise SystemExit(f"unknown command {command!r}")


if __name__ == "__main__":
    print(json.dumps(main(*sys.argv[1:])))
