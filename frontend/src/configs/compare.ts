import type { Placement } from "../api/types";
import type { StampSettings } from "../placement/state";
import { ROLES } from "../placement/state";

const EPSILON = 1e-6;

function samePlacement(a: Placement | null, b: Placement | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.font === b.font &&
    Math.abs(a.x - b.x) < EPSILON &&
    Math.abs(a.y - b.y) < EPSILON &&
    Math.abs(a.font_size - b.font_size) < EPSILON
  );
}

/** Whether two settings would print the same numbers in the same places. */
export function sameSettings(a: StampSettings, b: StampSettings): boolean {
  const fa = a.number_format;
  const fb = b.number_format;
  return (
    fa.prefix === fb.prefix &&
    fa.digits === fb.digits &&
    fa.suffix === fb.suffix &&
    ROLES.every((role) => samePlacement(a.placements[role], b.placements[role]))
  );
}

/** Versions are grouped by name ignoring case and extra whitespace, like the backend. */
export function nameKey(name: string): string {
  return name.trim().split(/\s+/).join(" ").toLowerCase();
}
