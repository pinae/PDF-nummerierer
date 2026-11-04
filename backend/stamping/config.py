import math
from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum

from .fonts import get_font, unsupported_characters
from .numbering import NumberFormat

MIN_FONT_SIZE = 1.0
MAX_FONT_SIZE = 200.0
# PDF pages can be at most 200 inches (14400 pt) wide or high (PDF 32000, Annex C).
MAX_COORDINATE = 14400.0


class PageRole(StrEnum):
    FIRST = "first"
    ODD = "odd"  # odd page numbers except page 1
    EVEN = "even"


def role_for_page(page_number: int) -> PageRole:
    """Role of a 1-based page number within one copy."""
    if page_number < 1:
        raise ValueError(f"Page numbers start at 1, got page {page_number}.")
    if page_number == 1:
        return PageRole.FIRST
    return PageRole.ODD if page_number % 2 else PageRole.EVEN


@dataclass(frozen=True)
class Placement:
    """Where and how the number is printed on pages of one role.

    (x, y) is the start of the text baseline in PDF points, measured from the
    bottom-left corner of the page as displayed (see geometry.py).
    """

    x: float
    y: float
    font_id: str
    font_size: float

    def __post_init__(self) -> None:
        if not all(
            math.isfinite(value) and 0 <= value <= MAX_COORDINATE for value in (self.x, self.y)
        ):
            raise ValueError(f"Placement coordinates must be between 0 and {MAX_COORDINATE:g} pt.")
        if not MIN_FONT_SIZE <= self.font_size <= MAX_FONT_SIZE:
            raise ValueError(
                f"The font size must be between {MIN_FONT_SIZE:g} and {MAX_FONT_SIZE:g} pt."
            )
        get_font(self.font_id)


@dataclass(frozen=True)
class StampConfig:
    placements: Mapping[PageRole, Placement]
    number_format: NumberFormat = field(default_factory=NumberFormat)

    def placement_for_page(self, page_number: int) -> Placement | None:
        return self.placements.get(role_for_page(page_number))

    def fonts_in_use(self) -> set[str]:
        return {placement.font_id for placement in self.placements.values()}

    def unsupported_characters(self) -> dict[str, set[str]]:
        """Characters of the number text each used font cannot print (only fonts with gaps)."""
        fmt = self.number_format
        text = f"{fmt.prefix}0123456789{fmt.suffix}"
        missing = {font: unsupported_characters(font, text) for font in self.fonts_in_use()}
        return {font: chars for font, chars in missing.items() if chars}
