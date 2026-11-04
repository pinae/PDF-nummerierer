"""Opening PDFs with consistent errors, and the one pypdf internal we rely on."""

from os import PathLike
from typing import BinaryIO

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError, PyPdfError
from pypdf.generic import IndirectObject, PdfObject

from .errors import EncryptedPdfError, InvalidPdfError


def open_pdf(source: str | PathLike | BinaryIO) -> PdfReader:
    try:
        reader = PdfReader(source)
        if reader.is_encrypted and not reader.decrypt(""):
            raise EncryptedPdfError("The PDF is password protected.")
        _ = len(reader.pages)
    except EncryptedPdfError:
        raise
    except (PdfReadError, PyPdfError, ValueError, KeyError, TypeError) as error:
        raise InvalidPdfError(f"The file is not a readable PDF: {error}") from error
    return reader


def add_object(writer: PdfWriter, obj: PdfObject) -> IndirectObject:
    """Register a new object in the writer (pypdf has no public API for this)."""
    return writer._add_object(obj)
