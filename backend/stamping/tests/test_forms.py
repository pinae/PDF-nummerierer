"""Form fields (port of create_form_dummy.py): their printed appearance is kept,
but the number is drawn on top, so a field can never hide it."""

import io

from pypdf import PdfReader

from stamping import PageRole, Placement, StampConfig, generate_copies

from .pdfs import FormField, PageSpec, make_pdf
from .render import ink_box, render

# A white text field covering the area where config.json puts the number.
FIELD = FormField(x=200, y=640, width=100, height=50)
CONFIG = StampConfig(placements={PageRole.FIRST: Placement(227, 661, "dejavu-sans", 12)})
INSIDE_FIELD = (205, 645, 295, 685)
LEFT_BORDER = (198, 645, 202, 685)


def generate(pdf: bytes) -> bytes:
    out = io.BytesIO()
    generate_copies(io.BytesIO(pdf), out, CONFIG, copies=2)
    return out.getvalue()


def test_number_is_visible_on_top_of_a_form_field():
    output = generate(make_pdf(PageSpec(text="Form page", form_fields=(FIELD,))))

    assert ink_box(render(output, 0), INSIDE_FIELD) is not None


def test_number_is_visible_on_a_white_box_in_the_page_content():
    """Exactly create_form_dummy.py: forceBorder paints the box into the content too."""
    dummy = FormField(x=200, y=640, width=100, height=50, force_border=True)

    output = generate(make_pdf(PageSpec(text="Form page", form_fields=(dummy,))))

    assert ink_box(render(output, 0), INSIDE_FIELD) is not None


def test_field_appearance_is_printed():
    output = generate(make_pdf(PageSpec(text="Form page", form_fields=(FIELD,))))

    assert ink_box(render(output, 0), LEFT_BORDER) is not None
    assert ink_box(render(output, 2), LEFT_BORDER) is not None


def test_fields_without_print_flag_are_not_printed():
    hidden = FormField(x=200, y=640, width=100, height=50, printable=False)

    output = generate(make_pdf(PageSpec(text="Form page", form_fields=(hidden,))))

    assert ink_box(render(output, 0), LEFT_BORDER) is None


def test_output_contains_no_form_fields():
    output = PdfReader(io.BytesIO(generate(make_pdf(PageSpec(form_fields=(FIELD,))))))

    assert "/AcroForm" not in output.trailer["/Root"]
    assert all("/Annots" not in page for page in output.pages)
