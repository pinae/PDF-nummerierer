import { describe, expect, it } from "vitest";

import { mmToPt, ptToMm, toPixels, toPoints } from "./coordinates";

const A4 = { width: 595.28, height: 841.89 };
const LANDSCAPE = { width: 841.89, height: 595.28 };

describe("PDF points ↔ screen pixels", () => {
  it("puts the bottom-left corner of the page at the bottom-left of the rendering", () => {
    expect(toPixels({ x: 0, y: 0 }, A4, 1)).toEqual({ left: 0, top: 841.89 });
  });

  it("puts the top-left corner at pixel (0, 0)", () => {
    expect(toPixels({ x: 0, y: 841.89 }, A4, 2)).toEqual({ left: 0, top: 0 });
  });

  it("scales with the zoom", () => {
    expect(toPixels({ x: 227, y: 661 }, A4, 2)).toEqual({ left: 454, top: (841.89 - 661) * 2 });
  });

  it("converts pixels back to points", () => {
    expect(toPoints({ left: 454, top: 361.78 }, A4, 2)).toEqual({ x: 227, y: 661 });
  });

  it.each([
    [A4, 0.5],
    [A4, 1.3333],
    [LANDSCAPE, 0.873],
    [{ width: 200, height: 200 }, 3],
  ])("round-trips exactly on a %o page at scale %f", (page, scale) => {
    for (const point of [
      { x: 0, y: 0 },
      { x: 227, y: 661 },
      { x: 144.5, y: 12.25 },
      { x: page.width, y: page.height },
    ]) {
      const back = toPoints(toPixels(point, page, scale), page, scale);
      expect(back.x).toBeCloseTo(point.x, 9);
      expect(back.y).toBeCloseTo(point.y, 9);
    }
  });
});

describe("millimetres", () => {
  it("converts both ways", () => {
    expect(ptToMm(72)).toBeCloseTo(25.4, 10);
    expect(mmToPt(25.4)).toBeCloseTo(72, 10);
    expect(ptToMm(mmToPt(123.4))).toBeCloseTo(123.4, 10);
  });
});
