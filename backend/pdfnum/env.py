"""Typed access to PDFNUM_* environment variables."""

import os

from django.core.exceptions import ImproperlyConfigured

_TRUE = {"1", "true", "on"}
_FALSE = {"0", "false", "off", ""}


def env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    value = raw.strip().lower()
    if value in _TRUE:
        return True
    if value in _FALSE:
        return False
    raise ImproperlyConfigured(f"{name} must be one of 1/0/true/false/on/off, got {raw!r}.")


def env_str(name: str, default: str | None = None) -> str | None:
    return os.environ.get(name, default)


def env_list(name: str, default: list[str]) -> list[str]:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


def env_int(name: str, default: int, *, minimum: int = 1) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ImproperlyConfigured(f"{name} must be an integer, got {raw!r}.") from None
    if value < minimum:
        raise ImproperlyConfigured(f"{name} must be at least {minimum}, got {value}.")
    return value
