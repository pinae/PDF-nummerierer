import type { Size } from "../pdf/coordinates";

/** CSS pixels per PDF point at 100 % (real paper size on a 96 dpi screen). */
export const CSS_PX_PER_PT = 96 / 72;
/** Space around the page inside the preview, in CSS pixels. */
export const VIEWPORT_PADDING = 24;
export const ZOOM_FACTORS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4,
];

export type Zoom =
  { kind: "fit-page" } | { kind: "fit-width" } | { kind: "factor"; factor: number };

/** CSS pixels per PDF point for a zoom setting, page and preview size. */
export function resolveScale(zoom: Zoom, page: Size, viewport: Size): number {
  if (zoom.kind === "factor") return zoom.factor * CSS_PX_PER_PT;
  const width = Math.max(viewport.width - 2 * VIEWPORT_PADDING, 1);
  const height = Math.max(viewport.height - 2 * VIEWPORT_PADDING, 1);
  const fitWidth = width / page.width;
  return zoom.kind === "fit-width" ? fitWidth : Math.min(fitWidth, height / page.height);
}

const EPSILON = 1e-6;

export function zoomIn(scale: number): Zoom {
  const factor = scale / CSS_PX_PER_PT;
  const next = ZOOM_FACTORS.find((f) => f > factor + EPSILON) ?? ZOOM_FACTORS.at(-1)!;
  return { kind: "factor", factor: next };
}

export function zoomOut(scale: number): Zoom {
  const factor = scale / CSS_PX_PER_PT;
  const next = [...ZOOM_FACTORS].reverse().find((f) => f < factor - EPSILON) ?? ZOOM_FACTORS[0]!;
  return { kind: "factor", factor: next };
}

export function formatZoom(scale: number): string {
  return `${Math.round((scale / CSS_PX_PER_PT) * 100)} %`;
}
