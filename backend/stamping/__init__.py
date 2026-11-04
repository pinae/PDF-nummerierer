"""Framework-free PDF stamping library.

Must never import Django: it takes a PDF plus a numbering config and writes
the numbered copies, so it can be tested without a database or HTTP.
"""

from .config import PageRole, Placement, StampConfig, role_for_page
from .errors import (
    EncryptedPdfError,
    InvalidPdfError,
    StampingError,
    UnknownFontError,
    UnsupportedCharactersError,
)
from .fonts import FONTS, FontCategory, FontSpec, get_font
from .generator import GenerationResult, Progress, generate_copies
from .geometry import PageGeometry, inspect_pdf
from .numbering import NumberFormat, format_serial

__all__ = [
    "FONTS",
    "EncryptedPdfError",
    "FontCategory",
    "FontSpec",
    "GenerationResult",
    "InvalidPdfError",
    "NumberFormat",
    "PageGeometry",
    "PageRole",
    "Placement",
    "Progress",
    "StampConfig",
    "StampingError",
    "UnknownFontError",
    "UnsupportedCharactersError",
    "format_serial",
    "generate_copies",
    "get_font",
    "inspect_pdf",
    "role_for_page",
]
