import { describe, expect, it } from "vitest";

import type { Placement } from "../api/types";
import { initialEditorState, placementReducer, type EditorState } from "./state";

const A4: [number, number] = [595.28, 841.89];
const at = (x: number, y: number, font = "cmu-serif", font_size = 12): Placement => ({
  x,
  y,
  font,
  font_size,
});

function state(): EditorState {
  return initialEditorState([A4, A4, A4]);
}

describe("initial state", () => {
  it("numbers every page type at the top right in Computer Modern 12 pt", () => {
    const { placements } = state().config;

    for (const role of ["first", "odd", "even"] as const) {
      const placement = placements[role]!;
      expect(placement.font).toBe("cmu-serif");
      expect(placement.font_size).toBe(12);
      expect(placement.x).toBeGreaterThan(A4[0] / 2);
      expect(placement.y).toBeGreaterThan(A4[1] - 60);
    }
  });

  it("uses four-digit numbers without prefix or suffix", () => {
    expect(state().config.number_format).toEqual({ prefix: "", digits: 4, suffix: "" });
  });
});

describe("placementReducer", () => {
  it("moves the number of one page type", () => {
    const next = placementReducer(state(), { type: "move", role: "odd", x: 100, y: 200 });

    expect(next.config.placements.odd).toMatchObject({ x: 100, y: 200 });
    expect(next.config.placements.first).toEqual(state().config.placements.first);
  });

  it("clamps positions to the page edges' valid range", () => {
    const next = placementReducer(state(), { type: "move", role: "first", x: -5, y: 99999 });

    expect(next.config.placements.first).toMatchObject({ x: 0, y: 14400 });
  });

  it("switches a page type off and back on at its old place", () => {
    let current = placementReducer(state(), { type: "move", role: "even", x: 42, y: 24 });
    current = placementReducer(current, { type: "enable", role: "even", enabled: false });
    expect(current.config.placements.even).toBeNull();

    current = placementReducer(current, { type: "enable", role: "even", enabled: true });

    expect(current.config.placements.even).toMatchObject({ x: 42, y: 24 });
  });

  it("moving a switched-off page type switches it on", () => {
    let current = placementReducer(state(), { type: "enable", role: "odd", enabled: false });
    current = placementReducer(current, { type: "move", role: "odd", x: 10, y: 20 });

    expect(current.config.placements.odd).toMatchObject({ x: 10, y: 20, font: "cmu-serif" });
  });

  it("changes font and size per page type", () => {
    const next = placementReducer(state(), {
      type: "style",
      role: "first",
      font: "caveat",
      font_size: 18,
    });

    expect(next.config.placements.first).toMatchObject({ font: "caveat", font_size: 18 });
    expect(next.config.placements.odd).toMatchObject({ font: "cmu-serif", font_size: 12 });
  });

  it("applies one page type's settings to all page types", () => {
    let current = placementReducer(state(), { type: "enable", role: "even", enabled: false });
    current = placementReducer(current, {
      type: "set",
      role: "first",
      placement: at(5, 6, "caveat", 9),
    });

    current = placementReducer(current, { type: "applyToAll", role: "first" });

    expect(current.config.placements).toEqual({
      first: at(5, 6, "caveat", 9),
      odd: at(5, 6, "caveat", 9),
      even: at(5, 6, "caveat", 9),
    });
  });

  it("loads a complete configuration and remembers its positions", () => {
    const loaded = {
      number_format: { prefix: "A-", digits: 3, suffix: "" },
      placements: { first: at(1, 2), odd: null, even: at(3, 4) },
    };

    let current = placementReducer(state(), { type: "load", config: loaded });
    expect(current.config).toEqual(loaded);

    current = placementReducer(current, { type: "enable", role: "odd", enabled: true });
    expect(current.config.placements.odd).not.toBeNull();
  });
});
