from dataclasses import dataclass

MAX_DIGITS = 12
MAX_AFFIX_LENGTH = 40


@dataclass(frozen=True)
class NumberFormat:
    """How a serial number is printed: prefix + zero-padded number + suffix."""

    prefix: str = ""
    digits: int = 4
    suffix: str = ""

    def __post_init__(self) -> None:
        if not 1 <= self.digits <= MAX_DIGITS:
            raise ValueError(f"digits must be between 1 and {MAX_DIGITS}, got {self.digits}.")
        for name in ("prefix", "suffix"):
            value = getattr(self, name)
            if len(value) > MAX_AFFIX_LENGTH:
                raise ValueError(f"{name} must be at most {MAX_AFFIX_LENGTH} characters long.")
            if not value.isprintable():
                raise ValueError(f"{name} must be a single line of printable characters.")

    def serials(self, start: int, copies: int) -> list[str]:
        return [format_serial(self, number) for number in range(start, start + copies)]


def format_serial(fmt: NumberFormat, number: int) -> str:
    if number < 0:
        raise ValueError(f"Serial numbers cannot be negative, got {number}.")
    return f"{fmt.prefix}{number:0{fmt.digits}d}{fmt.suffix}"
