import io

import pytest
from pypdf import PdfReader

from stamping import (
    EncryptedPdfError,
    GenerationResult,
    InvalidPdfError,
    NumberFormat,
    PageRole,
    Placement,
    Progress,
    StampConfig,
    UnsupportedCharactersError,
    generate_copies,
)

from .pdfs import A4, PageSpec, make_pdf, three_page_exam

# The configuration of the original script (config.json): page 1 and odd pages.
ORIGINAL_CONFIG = StampConfig(
    placements={
        PageRole.FIRST: Placement(227, 661, "cmu-serif", 12),
        PageRole.ODD: Placement(144, 780, "cmu-serif", 12),
    }
)


def generate(source: bytes, config: StampConfig = ORIGINAL_CONFIG, **kwargs) -> PdfReader:
    out = io.BytesIO()
    generate_copies(io.BytesIO(source), out, config, **kwargs)
    return PdfReader(io.BytesIO(out.getvalue()))


def texts(reader: PdfReader) -> list[str]:
    return [page.extract_text() for page in reader.pages]


def test_copies_are_joined_and_padded_to_even_length_by_default():
    reader = generate(three_page_exam(), copies=2)

    assert len(reader.pages) == 8


def test_padding_can_be_switched_off():
    reader = generate(three_page_exam(), copies=2, pad_to_even=False)

    assert len(reader.pages) == 6


def test_documents_with_even_length_are_not_padded():
    pdf = make_pdf(PageSpec(text="one"), PageSpec(text="two"))

    assert len(generate(pdf, copies=3).pages) == 6


def test_original_script_semantics_first_and_odd_pages_numbered():
    pages = texts(generate(three_page_exam(), copies=2, pad_to_even=False))

    assert ["0001" in t for t in pages[:3]] == [True, False, True]
    assert ["0002" in t for t in pages[3:]] == [True, False, True]
    assert "0002" not in "".join(pages[:3])


def test_original_content_is_kept():
    pages = texts(generate(three_page_exam(), copies=2, pad_to_even=False))

    assert [("This is page" in t) for t in pages] == [True] * 6
    assert "This is page 2" in pages[4]


def test_padding_page_is_blank_and_matches_the_last_page():
    pdf = make_pdf(
        PageSpec(text="cover"),
        PageSpec(text="middle"),
        PageSpec(size=(400, 300), text="last", rotate=90, cropbox=(10, 10, 390, 290)),
    )
    reader = generate(pdf, copies=1)

    padding = reader.pages[3]
    assert padding.extract_text() == ""
    assert padding.mediabox == reader.pages[2].mediabox
    assert padding.cropbox == reader.pages[2].cropbox
    assert padding.rotation == 90


def test_padding_pages_are_not_numbered():
    config = StampConfig(placements={PageRole.EVEN: Placement(50, 50, "cmu-serif", 12)})

    pages = texts(generate(three_page_exam(), config, copies=1))

    assert ["0001" in t for t in pages] == [False, True, False, False]


def test_start_number_and_number_format():
    config = StampConfig(
        placements=ORIGINAL_CONFIG.placements,
        number_format=NumberFormat(prefix="Exam A-", digits=3),
    )

    pages = texts(generate(three_page_exam(), config, copies=2, start=41))

    assert "Exam A-041" in pages[0]
    assert "Exam A-042" in pages[4]


def test_without_placements_the_copies_are_plain():
    pages = texts(generate(three_page_exam(), StampConfig(placements={}), copies=2))

    assert len(pages) == 8
    assert not any("0001" in t for t in pages)


def test_different_fonts_per_role():
    config = StampConfig(
        placements={
            PageRole.FIRST: Placement(100, 100, "caveat", 20),
            PageRole.EVEN: Placement(100, 100, "dejavu-sans", 10),
            PageRole.ODD: Placement(100, 100, "indie-flower", 14),
        }
    )

    pages = texts(generate(three_page_exam(), config, copies=1, pad_to_even=False))

    assert all("0001" in t for t in pages)


def test_result_describes_the_output():
    out = io.BytesIO()

    result = generate_copies(io.BytesIO(three_page_exam()), out, ORIGINAL_CONFIG, copies=5)

    assert result == GenerationResult(copies=5, pages_per_copy=4, total_pages=20)


def test_progress_is_reported_from_the_start_per_copy_and_while_writing():
    events: list[Progress] = []

    generate(three_page_exam(), copies=3, on_progress=events.append)

    assert [(e.stage, e.copies_done, e.copies_total) for e in events] == [
        ("preparing", 0, 3),
        ("stamping", 0, 3),
        ("stamping", 1, 3),
        ("stamping", 2, 3),
        ("stamping", 3, 3),
        ("writing", 3, 3),
        ("done", 3, 3),
    ]


def test_accepts_paths_and_bytes(tmp_path):
    source = tmp_path / "exam.pdf"
    source.write_bytes(three_page_exam())
    target = tmp_path / "out.pdf"

    generate_copies(source, target, ORIGINAL_CONFIG, copies=1)
    generate_copies(source.read_bytes(), tmp_path / "out2.pdf", ORIGINAL_CONFIG, copies=1)

    assert len(PdfReader(target).pages) == 4
    assert len(PdfReader(tmp_path / "out2.pdf").pages) == 4


def test_output_has_no_interactive_leftovers():
    reader = generate(three_page_exam(), copies=2)

    assert "/AcroForm" not in reader.trailer["/Root"]
    assert all("/Annots" not in page for page in reader.pages)


@pytest.mark.parametrize(("copies", "start"), [(0, 1), (-1, 1), (1, -1)])
def test_invalid_run_parameters(copies, start):
    with pytest.raises(ValueError, match=r"copies|start"):
        generate(three_page_exam(), copies=copies, start=start)


def test_characters_missing_in_a_font_are_rejected_before_generating():
    config = StampConfig(
        placements={PageRole.FIRST: Placement(1, 1, "caveat", 12)},
        number_format=NumberFormat(prefix="中"),
    )
    out = io.BytesIO()

    with pytest.raises(UnsupportedCharactersError, match=r"中.*Caveat"):
        generate_copies(io.BytesIO(three_page_exam()), out, config, copies=1)
    assert out.getvalue() == b""


def test_garbage_is_not_a_pdf():
    with pytest.raises(InvalidPdfError):
        generate(b"this is not a pdf", copies=1)


def test_password_protected_pdfs_are_rejected():
    with pytest.raises(EncryptedPdfError):
        generate(make_pdf(PageSpec(text="secret"), password="s3cret"), copies=1)


def test_pdfs_encrypted_without_user_password_are_accepted():
    pdf = make_pdf(PageSpec(text="restricted"), password="")

    pages = texts(generate(pdf, copies=1))

    assert "0001" in pages[0]
    assert "restricted" in pages[0]


def test_a4_size_is_kept():
    reader = generate(three_page_exam(), copies=1)

    assert (float(reader.pages[0].mediabox.width), float(reader.pages[0].mediabox.height)) == (
        pytest.approx(A4[0]),
        pytest.approx(A4[1]),
    )
