"""Registry of the fonts a number can be stamped in.

This is the single place that defines the font list (keep it below 10
entries). The TTF files and their licenses live next to this module, so the
browser preview can serve exactly the same files.
"""

from dataclasses import dataclass
from enum import StrEnum
from functools import cache
from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from .errors import UnknownFontError

FONT_DIR = Path(__file__).resolve().parent / "fonts"


class FontCategory(StrEnum):
    SERIF = "serif"
    SANS_SERIF = "sans-serif"
    HANDWRITTEN = "handwritten"


@dataclass(frozen=True)
class FontSpec:
    id: str
    label: str
    category: FontCategory
    license_file: str

    @property
    def path(self) -> Path:
        return FONT_DIR / f"{self.id}.ttf"

    @property
    def license_path(self) -> Path:
        return FONT_DIR / "licenses" / self.license_file

    @property
    def reportlab_name(self) -> str:
        return f"PdfNum-{self.id}"


FONTS: tuple[FontSpec, ...] = (
    FontSpec("cmu-serif", "Computer Modern Roman", FontCategory.SERIF, "cmu.txt"),
    FontSpec("libertinus-serif", "Libertinus Serif", FontCategory.SERIF, "libertinus-serif.txt"),
    FontSpec("noto-serif", "Noto Serif", FontCategory.SERIF, "noto-serif.txt"),
    FontSpec("cmu-sans-serif", "Computer Modern Sans", FontCategory.SANS_SERIF, "cmu.txt"),
    FontSpec("source-sans-3", "Source Sans 3", FontCategory.SANS_SERIF, "source-sans-3.txt"),
    FontSpec("dejavu-sans", "DejaVu Sans", FontCategory.SANS_SERIF, "dejavu-sans.txt"),
    FontSpec("caveat", "Caveat", FontCategory.HANDWRITTEN, "caveat.txt"),
    FontSpec("patrick-hand", "Patrick Hand", FontCategory.HANDWRITTEN, "patrick-hand.txt"),
    FontSpec("indie-flower", "Indie Flower", FontCategory.HANDWRITTEN, "indie-flower.txt"),
)

_BY_ID = {font.id: font for font in FONTS}


def get_font(font_id: str) -> FontSpec:
    try:
        return _BY_ID[font_id]
    except KeyError:
        raise UnknownFontError(f"Unknown font {font_id!r}.") from None


@cache
def register_font(font_id: str) -> str:
    """Register the font with reportlab (once) and return its reportlab name."""
    font = get_font(font_id)
    pdfmetrics.registerFont(TTFont(font.reportlab_name, str(font.path)))
    return font.reportlab_name


def unsupported_characters(font_id: str, text: str) -> set[str]:
    face = pdfmetrics.getFont(register_font(font_id)).face
    return {char for char in text if ord(char) not in face.charToGlyph}


def string_width(font_id: str, text: str, size: float) -> float:
    return pdfmetrics.stringWidth(text, register_font(font_id), size)
