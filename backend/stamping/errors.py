class StampingError(Exception):
    """Base class for all errors raised by the stamping library."""


class InvalidPdfError(StampingError):
    """The input is not a readable PDF."""


class EncryptedPdfError(StampingError):
    """The PDF needs a password to be opened."""


class UnknownFontError(StampingError, ValueError):
    """A font id that is not in the font registry."""


class UnsupportedCharactersError(StampingError, ValueError):
    """The number text contains characters the chosen font cannot render."""
