"""Builders for fixture PDFs used by the stamping tests (ports of create_dummy.py
and create_form_dummy.py, plus pages with rotation, crop boxes and images)."""

import io
import random
from dataclasses import dataclass, field

from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, NumberObject, RectangleObject
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, A5, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

__all__ = ["A4", "A5", "FormField", "PageSpec", "landscape", "make_pdf"]


@dataclass(frozen=True)
class FormField:
    x: float
    y: float
    width: float
    height: float
    printable: bool = True
    # reportlab's forceBorder also paints the white box into the page content
    force_border: bool = False


@dataclass(frozen=True)
class PageSpec:
    size: tuple[float, float] = A4
    text: str | None = None
    rotate: int = 0
    cropbox: tuple[float, float, float, float] | None = None
    image_bytes: int = 0  # > 0 draws an incompressible RGB image of about this size
    form_fields: tuple[FormField, ...] = field(default_factory=tuple)


def _noise_image(approx_bytes: int) -> ImageReader:
    side = max(8, int((approx_bytes / 3) ** 0.5))
    rng = random.Random(42)
    image = Image.frombytes("RGB", (side, side), rng.randbytes(side * side * 3))
    return ImageReader(image)


def make_pdf(*pages: PageSpec, password: str | None = None) -> bytes:
    """Build a PDF with one page per spec and return its bytes."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer)
    for index, spec in enumerate(pages):
        c.setPageSize(spec.size)
        if spec.text:
            c.drawString(100, 750 if spec.size[1] > 760 else spec.size[1] - 40, spec.text)
        if spec.image_bytes:
            c.drawImage(_noise_image(spec.image_bytes), 50, 50, width=200, height=200)
        for number, ff in enumerate(spec.form_fields):
            c.acroForm.textfield(
                name=f"field_{index}_{number}",
                x=ff.x,
                y=ff.y,
                width=ff.width,
                height=ff.height,
                borderColor=colors.black,
                fillColor=colors.white,
                textColor=colors.black,
                forceBorder=ff.force_border,
            )
        c.showPage()
    c.save()

    reader = PdfReader(io.BytesIO(buffer.getvalue()))
    writer = PdfWriter(clone_from=reader)
    for spec, page in zip(pages, writer.pages, strict=True):
        if spec.rotate:
            page[NameObject("/Rotate")] = NumberObject(spec.rotate)
        if spec.cropbox:
            page[NameObject("/CropBox")] = RectangleObject(spec.cropbox)
        for ff, annot_ref in zip(spec.form_fields, page.get("/Annots", []), strict=False):
            if not ff.printable:
                annot_ref.get_object()[NameObject("/F")] = NumberObject(0)
    if password:
        writer.encrypt(user_password=password, algorithm="AES-256")
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def three_page_exam() -> bytes:
    """Port of create_dummy.py: three A4 pages with a line of text each."""
    return make_pdf(*(PageSpec(text=f"This is page {n}") for n in (1, 2, 3)))


def landscape_a5() -> tuple[float, float]:
    return landscape(A5)
