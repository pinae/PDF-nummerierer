"""Generate N numbered copies of a PDF and join them into one print-ready PDF.

Output structure (keeps the file small for thousands of copies):

* Every source page is turned into ONE Form XObject, written once. Printable
  form-field/annotation appearances are flattened into it, so nothing
  interactive can hide the number and the printout looks like the original.
* Every serial number becomes a tiny Form XObject (fonts are embedded once).
* An output page only references the page form and its number form through
  a content stream that is shared by all copies of that page.
"""

import io
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from os import PathLike
from typing import BinaryIO, Literal

from pypdf import PageObject, PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    FloatObject,
    IndirectObject,
    NameObject,
    NumberObject,
    RectangleObject,
    StreamObject,
)
from reportlab.pdfgen import canvas

from .config import Placement, StampConfig
from .errors import UnsupportedCharactersError
from .fonts import get_font, register_font, string_width, unsupported_characters
from .geometry import Matrix, PageGeometry
from .pdfio import add_object, open_pdf

Source = str | PathLike | BinaryIO | bytes
Target = str | PathLike | BinaryIO

PAGE_FORM = NameObject("/PdfNumPage")
STAMP_FORM = NameObject("/PdfNumStamp")

_PRINT_FLAG = 4
_HIDDEN_FLAG = 2


@dataclass(frozen=True)
class Progress:
    stage: Literal["preparing", "stamping", "writing", "done"]
    copies_done: int
    copies_total: int


@dataclass(frozen=True)
class GenerationResult:
    copies: int
    pages_per_copy: int
    total_pages: int


ProgressCallback = Callable[[Progress], None]


@dataclass(frozen=True)
class _PageTemplate:
    """Everything about one source page that is shared by all copies."""

    mediabox: RectangleObject
    cropbox: RectangleObject
    rotation: int
    group: IndirectObject | DictionaryObject | None
    page_form: IndirectObject | None
    contents: IndirectObject | None
    placement: Placement | None


def generate_copies(
    source: Source,
    target: Target,
    config: StampConfig,
    *,
    copies: int,
    start: int = 1,
    pad_to_even: bool = True,
    on_progress: ProgressCallback | None = None,
) -> GenerationResult:
    """Write `copies` numbered copies of `source` (numbers start..start+copies-1) to `target`.

    Pages of each copy get their number according to `config`. With
    `pad_to_even`, copies with an odd page count get a blank page appended so
    every copy starts on a new sheet in duplex printing.
    """
    if copies < 1:
        raise ValueError(f"copies must be at least 1, got {copies}.")
    if start < 0:
        raise ValueError(f"start must not be negative, got {start}.")
    _check_characters(config)
    report = on_progress or (lambda progress: None)
    report(Progress("preparing", 0, copies))

    reader = open_pdf(io.BytesIO(source) if isinstance(source, bytes) else source)
    writer = PdfWriter()
    templates = [
        _page_template(writer, page, config.placement_for_page(number))
        for number, page in enumerate(reader.pages, start=1)
    ]
    serials = config.number_format.serials(start, copies)
    stamps = _stamp_forms(writer, serials, config.placements.values())
    padded = pad_to_even and len(templates) % 2 == 1
    pages_per_copy = len(templates) + padded

    report(Progress("stamping", 0, copies))
    for done, serial in enumerate(serials, start=1):
        for template in templates:
            stamp = stamps[(serial, _font_key(template.placement))] if template.placement else None
            _add_page(writer, template, stamp)
        if padded:
            _add_blank_page(writer, templates[-1])
        report(Progress("stamping", done, copies))

    report(Progress("writing", copies, copies))
    writer.write(target)
    report(Progress("done", copies, copies))
    return GenerationResult(copies, pages_per_copy, copies * pages_per_copy)


def _check_characters(config: StampConfig) -> None:
    fmt = config.number_format
    text = f"{fmt.prefix}0123456789{fmt.suffix}"
    for font_id in sorted(config.fonts_in_use()):
        missing = unsupported_characters(font_id, text)
        if missing:
            raise UnsupportedCharactersError(
                f"The characters {''.join(sorted(missing))!r} cannot be printed in "
                f"{get_font(font_id).label}."
            )


# --- page forms ---------------------------------------------------------------


def _page_template(
    writer: PdfWriter, page: PageObject, placement: Placement | None
) -> _PageTemplate:
    geometry = PageGeometry.from_page(page)
    page_form = _page_form(writer, page)
    operations = b""
    if page_form is not None:
        operations += b"q /PdfNumPage Do Q\n"
    if placement is not None:
        matrix = geometry.stamp_matrix(placement.x, placement.y)
        operations += b"q " + _matrix_bytes(matrix) + b" cm /PdfNumStamp Do Q\n"
    group = page.raw_get("/Group") if "/Group" in page else None
    return _PageTemplate(
        mediabox=RectangleObject(page.mediabox),
        cropbox=RectangleObject(page.cropbox),
        rotation=geometry.rotation,
        group=group.clone(writer) if group is not None else None,
        page_form=page_form,
        contents=_add_stream(writer, operations) if operations else None,
        placement=placement,
    )


def _page_form(writer: PdfWriter, page: PageObject) -> IndirectObject | None:
    contents = page.get_contents()
    data = contents.get_data() if contents is not None else b""
    resources = DictionaryObject()
    if "/Resources" in page:
        resources.update(page.raw_get("/Resources").clone(writer).get_object())

    xobjects = DictionaryObject(resources.get("/XObject", DictionaryObject()))
    flattened = b""
    for number, (appearance, matrix) in enumerate(_printable_appearances(page)):
        name = _unused_name(xobjects, f"/PdfNumAnnot{number}")
        xobjects[name] = appearance.clone(writer)
        flattened += b"q " + _matrix_bytes(matrix) + b" cm " + name.encode() + b" Do Q\n"
    if flattened:
        resources[NameObject("/XObject")] = xobjects

    if not data.strip() and not flattened:
        return None
    form = DecodedStreamObject()
    form.set_data(b"q\n" + data + b"\nQ\n" + flattened)
    form.update(
        {
            NameObject("/Type"): NameObject("/XObject"),
            NameObject("/Subtype"): NameObject("/Form"),
            NameObject("/BBox"): RectangleObject(page.mediabox),
            NameObject("/Resources"): resources,
        }
    )
    return add_object(writer, form.flate_encode())


def _printable_appearances(page: PageObject) -> Iterable[tuple[IndirectObject, Matrix]]:
    """Normal appearance streams of printable annotations, with their placement matrix."""
    for annotation in page.get("/Annots", None) or []:
        annotation = annotation.get_object()
        flags = int(annotation.get("/F", 0))
        if not flags & _PRINT_FLAG or flags & _HIDDEN_FLAG:
            continue
        appearances = annotation.get("/AP")
        if not isinstance(appearances, DictionaryObject) or "/N" not in appearances:
            continue
        normal = appearances.raw_get("/N")
        resolved = normal.get_object()
        if not isinstance(resolved, StreamObject):
            state = annotation.get("/AS")
            if not isinstance(resolved, DictionaryObject) or state not in resolved:
                continue
            normal = resolved.raw_get(state)
            resolved = normal.get_object()
        if not isinstance(resolved, StreamObject) or not isinstance(normal, IndirectObject):
            continue
        matrix = _appearance_matrix(resolved, annotation.get("/Rect"))
        if matrix is not None:
            yield normal, matrix


def _appearance_matrix(form: StreamObject, rect) -> Matrix | None:
    """Matrix mapping the transformed form BBox onto the annotation Rect (PDF 32000 12.5.5)."""
    if rect is None or "/BBox" not in form:
        return None
    a, b, c, d, e, f = (float(v) for v in form.get("/Matrix", (1, 0, 0, 1, 0, 0)))
    x0, y0, x1, y1 = (float(v) for v in form["/BBox"])
    corners = [(a * x + c * y + e, b * x + d * y + f) for x in (x0, x1) for y in (y0, y1)]
    bx0, bx1 = min(p[0] for p in corners), max(p[0] for p in corners)
    by0, by1 = min(p[1] for p in corners), max(p[1] for p in corners)
    rx0, ry0, rx1, ry1 = (float(v) for v in rect)
    rx0, rx1, ry0, ry1 = min(rx0, rx1), max(rx0, rx1), min(ry0, ry1), max(ry0, ry1)
    if bx1 - bx0 <= 0 or by1 - by0 <= 0:
        return None
    sx = (rx1 - rx0) / (bx1 - bx0)
    sy = (ry1 - ry0) / (by1 - by0)
    return (sx, 0, 0, sy, rx0 - bx0 * sx, ry0 - by0 * sy)


# --- number forms -------------------------------------------------------------

_FontKey = tuple[str, float]


def _font_key(placement: Placement) -> _FontKey:
    return (placement.font_id, placement.font_size)


def _stamp_forms(
    writer: PdfWriter, serials: list[str], placements: Iterable[Placement]
) -> dict[tuple[str, _FontKey], IndirectObject]:
    """One Form XObject per (serial, font, size), all sharing one embedded font subset."""
    keys = sorted({_font_key(p) for p in placements})
    if not keys:
        return {}

    buffer = io.BytesIO()
    overlay = canvas.Canvas(buffer, pagesize=(100, 100), pageCompression=1)
    for serial in serials:
        for font_id, size in keys:
            overlay.setFont(register_font(font_id), size)
            overlay.drawString(0, 0, serial)
            overlay.showPage()
    overlay.save()

    reader = PdfReader(buffer)
    forms = {}
    pages = iter(reader.pages)
    for serial in serials:
        for font_id, size in keys:
            page = next(pages)
            width = string_width(font_id, serial, size)
            form = DecodedStreamObject()
            form.set_data(page.get_contents().get_data())
            form.update(
                {
                    NameObject("/Type"): NameObject("/XObject"),
                    NameObject("/Subtype"): NameObject("/Form"),
                    NameObject("/BBox"): ArrayObject(
                        FloatObject(v) for v in (-size, -size, width + size, 2 * size)
                    ),
                    NameObject("/Resources"): page.raw_get("/Resources").clone(writer),
                }
            )
            forms[(serial, (font_id, size))] = add_object(writer, form.flate_encode())
    return forms


# --- output pages -------------------------------------------------------------


def _add_page(writer: PdfWriter, template: _PageTemplate, stamp: IndirectObject | None) -> None:
    page = _new_page(writer, template)
    xobjects = DictionaryObject()
    if template.page_form is not None:
        xobjects[PAGE_FORM] = template.page_form
    if stamp is not None:
        xobjects[STAMP_FORM] = stamp
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/XObject"): xobjects})
    if template.contents is not None:
        page[NameObject("/Contents")] = template.contents
    if template.group is not None:
        page[NameObject("/Group")] = template.group


def _add_blank_page(writer: PdfWriter, template: _PageTemplate) -> None:
    _new_page(writer, template)[NameObject("/Resources")] = DictionaryObject()


def _new_page(writer: PdfWriter, template: _PageTemplate) -> PageObject:
    page = writer.add_blank_page(width=1, height=1)
    page[NameObject("/MediaBox")] = template.mediabox
    page[NameObject("/CropBox")] = template.cropbox
    if template.rotation:
        page[NameObject("/Rotate")] = NumberObject(template.rotation)
    return page


# --- helpers -------------------------------------------------------------------


def _add_stream(writer: PdfWriter, data: bytes) -> IndirectObject:
    stream = DecodedStreamObject()
    stream.set_data(data)
    return add_object(writer, stream.flate_encode())


def _matrix_bytes(matrix: Matrix) -> bytes:
    return " ".join(_number(v) for v in matrix).encode()


def _number(value: float) -> str:
    text = f"{value:.4f}".rstrip("0").rstrip(".")
    return "0" if text in ("-0", "") else text


def _unused_name(names: DictionaryObject, wanted: str) -> NameObject:
    name, suffix = wanted, 0
    while name in names:
        suffix += 1
        name = f"{wanted}_{suffix}"
    return NameObject(name)
