import { describe, expect, it } from "vitest";

import type { StampSettings } from "../placement/state";
import { nameKey, sameSettings } from "./compare";

const settings = (): StampSettings => ({
  number_format: { prefix: "", digits: 4, suffix: "" },
  placements: {
    first: { x: 227, y: 661, font: "cmu-serif", font_size: 12 },
    odd: null,
    even: { x: 144, y: 780, font: "caveat", font_size: 14 },
  },
});

describe("sameSettings", () => {
  it("treats equal settings as unchanged", () => {
    expect(sameSettings(settings(), settings())).toBe(true);
  });

  it("ignores floating point noise", () => {
    const moved = settings();
    moved.placements.first = { ...moved.placements.first!, x: 227 + 1e-9 };

    expect(sameSettings(settings(), moved)).toBe(true);
  });

  it.each([
    ["a moved number", (s: StampSettings) => (s.placements.first!.x += 1)],
    ["another font", (s: StampSettings) => (s.placements.even!.font = "cmu-serif")],
    ["another size", (s: StampSettings) => (s.placements.even!.font_size = 15)],
    ["a page type switched on", (s: StampSettings) => (s.placements.odd = s.placements.first)],
    ["a page type switched off", (s: StampSettings) => (s.placements.first = null)],
    ["another prefix", (s: StampSettings) => (s.number_format.prefix = "A-")],
    ["other digits", (s: StampSettings) => (s.number_format.digits = 3)],
  ])("notices %s", (_, change) => {
    const changed = settings();
    change(changed);

    expect(sameSettings(settings(), changed)).toBe(false);
  });
});

describe("nameKey (same rule as the backend)", () => {
  it("ignores case and extra whitespace", () => {
    expect(nameKey("  HCI   Exam ")).toBe(nameKey("hci exam"));
  });

  it("distinguishes different names", () => {
    expect(nameKey("HCI Exam")).not.toBe(nameKey("HCI Exam 2"));
  });
});
