"""Page geometry in the coordinate system the user sees.

A position is given in PDF points from the bottom-left corner of the page as
displayed: the crop box (clipped to the media box) after applying /Rotate.
This is what the browser preview shows, so a stamp lands where it was placed
and reads upright even on rotated pages or pages with an offset crop box.
"""

import io
from dataclasses import dataclass
from os import PathLike
from typing import BinaryIO

from pypdf import PageObject

from .pdfio import open_pdf

Box = tuple[float, float, float, float]
Matrix = tuple[float, float, float, float, float, float]


@dataclass(frozen=True)
class PageGeometry:
    box: Box  # visible box in user space: (left, bottom, right, top)
    rotation: int = 0  # clockwise quarter turns applied when displaying, in degrees

    def __post_init__(self) -> None:
        rotation = self.rotation % 360
        object.__setattr__(self, "rotation", rotation if rotation % 90 == 0 else 0)

    @classmethod
    def from_page(cls, page: PageObject) -> PageGeometry:
        media = _normalized(page.mediabox)
        crop = _normalized(page.cropbox)
        box = (
            max(media[0], crop[0]),
            max(media[1], crop[1]),
            min(media[2], crop[2]),
            min(media[3], crop[3]),
        )
        if box[0] >= box[2] or box[1] >= box[3]:
            box = media
        return cls(box=box, rotation=int(page.get("/Rotate", 0)))

    @property
    def _box_size(self) -> tuple[float, float]:
        left, bottom, right, top = self.box
        return right - left, top - bottom

    @property
    def width(self) -> float:
        w, h = self._box_size
        return h if self.rotation in (90, 270) else w

    @property
    def height(self) -> float:
        w, h = self._box_size
        return w if self.rotation in (90, 270) else h

    def stamp_matrix(self, x: float, y: float) -> Matrix:
        """Matrix placing upright text drawn at the origin at displayed point (x, y)."""
        left, bottom, right, top = self.box
        match self.rotation:
            case 90:
                return (0, 1, -1, 0, right - y, bottom + x)
            case 180:
                return (-1, 0, 0, -1, right - x, top - y)
            case 270:
                return (0, -1, 1, 0, left + y, top - x)
            case _:
                return (1, 0, 0, 1, left + x, bottom + y)


def _normalized(rect) -> Box:
    x1, y1, x2, y2 = (float(v) for v in rect)
    return (min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2))


def inspect_pdf(source: str | PathLike | BinaryIO | bytes) -> list[PageGeometry]:
    if isinstance(source, bytes):
        source = io.BytesIO(source)
    reader = open_pdf(source)
    return [PageGeometry.from_page(page) for page in reader.pages]
