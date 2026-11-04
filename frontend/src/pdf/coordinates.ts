/**
 * The one conversion between PDF points and screen pixels.
 *
 * Points are measured from the bottom-left corner of the page AS DISPLAYED
 * (crop box after /Rotate, see docs/PLANNING.md), y upwards. Pixels are CSS
 * pixels from the top-left corner of the rendered page, y downwards. Because
 * both describe the displayed page, rotation needs no special casing here.
 */

export interface Size {
  width: number;
  height: number;
}

/** PDF points, from the bottom-left of the displayed page. */
export interface Point {
  x: number;
  y: number;
}

/** CSS pixels, from the top-left of the rendered page. */
export interface Pixel {
  left: number;
  top: number;
}

export function toPixels(point: Point, page: Size, scale: number): Pixel {
  return { left: point.x * scale, top: (page.height - point.y) * scale };
}

export function toPoints(pixel: Pixel, page: Size, scale: number): Point {
  return { x: pixel.left / scale, y: page.height - pixel.top / scale };
}

const MM_PER_PT = 25.4 / 72;

export const ptToMm = (pt: number) => pt * MM_PER_PT;
export const mmToPt = (mm: number) => mm / MM_PER_PT;
