import { describe, expect, it } from "vitest";

import { CSS_PX_PER_PT, formatZoom, resolveScale, VIEWPORT_PADDING, zoomIn, zoomOut } from "./zoom";

const A4 = { width: 595.28, height: 841.89 };
const viewport = { width: 1000, height: 800 };
const inner = { width: 1000 - 2 * VIEWPORT_PADDING, height: 800 - 2 * VIEWPORT_PADDING };

describe("zoom", () => {
  it("fits the whole page into the viewport", () => {
    const scale = resolveScale({ kind: "fit-page" }, A4, viewport);

    expect(scale).toBeCloseTo(Math.min(inner.width / A4.width, inner.height / A4.height), 9);
    expect(A4.height * scale).toBeLessThanOrEqual(inner.height + 1e-9);
  });

  it("fits the page width", () => {
    expect(resolveScale({ kind: "fit-width" }, A4, viewport)).toBeCloseTo(
      inner.width / A4.width,
      9,
    );
  });

  it("100 % is the real paper size on screen", () => {
    expect(resolveScale({ kind: "factor", factor: 1 }, A4, viewport)).toBe(CSS_PX_PER_PT);
    expect(formatZoom(CSS_PX_PER_PT)).toBe("100 %");
  });

  it("never fits to nothing in a collapsed viewport", () => {
    expect(resolveScale({ kind: "fit-page" }, A4, { width: 0, height: 0 })).toBeGreaterThan(0);
  });

  it("zooms in and out in steps starting from the current scale", () => {
    expect(zoomIn(CSS_PX_PER_PT)).toEqual({ kind: "factor", factor: 1.1 });
    expect(zoomOut(CSS_PX_PER_PT)).toEqual({ kind: "factor", factor: 0.9 });
    expect(zoomIn(0.93 * CSS_PX_PER_PT)).toEqual({ kind: "factor", factor: 1 });
    expect(zoomOut(0.93 * CSS_PX_PER_PT)).toEqual({ kind: "factor", factor: 0.9 });
  });

  it("stops at the smallest and largest step", () => {
    expect(zoomIn(4 * CSS_PX_PER_PT)).toEqual({ kind: "factor", factor: 4 });
    expect(zoomOut(0.25 * CSS_PX_PER_PT)).toEqual({ kind: "factor", factor: 0.25 });
  });

  it("formats the zoom as a rounded percentage", () => {
    expect(formatZoom(0.6699 * CSS_PX_PER_PT)).toBe("67 %");
  });
});
