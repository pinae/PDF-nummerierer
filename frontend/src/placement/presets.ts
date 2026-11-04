import type { Point, Size } from "../pdf/coordinates";
import type { TextMetrics } from "./measure";

export const PRESET_ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

export type PresetAnchor = (typeof PRESET_ANCHORS)[number];

/**
 * Baseline start that puts the text box (width × ascent) at an anchor of the
 * page, `margin` points away from the edges.
 */
export function presetPoint(
  anchor: PresetAnchor,
  page: Size,
  metrics: TextMetrics,
  margin: number,
): Point {
  const [vertical, horizontal] = anchor === "center" ? ["middle", "center"] : anchor.split("-");
  const x =
    horizontal === "left"
      ? margin
      : horizontal === "right"
        ? page.width - margin - metrics.width
        : (page.width - metrics.width) / 2;
  const y =
    vertical === "bottom"
      ? margin
      : vertical === "top"
        ? page.height - margin - metrics.ascent
        : (page.height - metrics.ascent) / 2;
  return { x: Math.max(0, x), y: Math.max(0, y) };
}
