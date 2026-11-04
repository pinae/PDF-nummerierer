import { describe, expect, it } from "vitest";

import { PRESET_ANCHORS, presetPoint } from "./presets";

const A4 = { width: 595.28, height: 841.89 };
const metrics = { width: 30, ascent: 8 };
const margin = 28.35; // 10 mm

describe("position presets", () => {
  it("offers a 3 × 3 grid", () => {
    expect(PRESET_ANCHORS).toHaveLength(9);
  });

  it.each([
    ["top-left", { x: margin, y: A4.height - margin - 8 }],
    ["top-center", { x: (A4.width - 30) / 2, y: A4.height - margin - 8 }],
    ["top-right", { x: A4.width - margin - 30, y: A4.height - margin - 8 }],
    ["middle-left", { x: margin, y: (A4.height - 8) / 2 }],
    ["center", { x: (A4.width - 30) / 2, y: (A4.height - 8) / 2 }],
    ["middle-right", { x: A4.width - margin - 30, y: (A4.height - 8) / 2 }],
    ["bottom-left", { x: margin, y: margin }],
    ["bottom-center", { x: (A4.width - 30) / 2, y: margin }],
    ["bottom-right", { x: A4.width - margin - 30, y: margin }],
  ] as const)("%s keeps the text inside the margin", (anchor, expected) => {
    const point = presetPoint(anchor, A4, metrics, margin);

    expect(point.x).toBeCloseTo(expected.x, 9);
    expect(point.y).toBeCloseTo(expected.y, 9);
  });

  it("never places text outside a tiny page", () => {
    const point = presetPoint("top-right", { width: 20, height: 5 }, metrics, margin);

    expect(point).toEqual({ x: 0, y: 0 });
  });
});
