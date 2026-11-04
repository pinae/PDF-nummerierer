import { fontFamily } from "./fonts";

/** Size of a stamped text in PDF points. */
export interface TextMetrics {
  width: number;
  /** Height of the text above its baseline. */
  ascent: number;
}

let context: OffscreenCanvasRenderingContext2D | null | undefined;

function canvasContext() {
  if (context === undefined) {
    context =
      typeof OffscreenCanvas === "undefined" ? null : new OffscreenCanvas(1, 1).getContext("2d");
  }
  return context;
}

/**
 * Measures text in the bundled font (once loaded; see fonts.ts). Without a
 * canvas (jsdom) a fixed estimate keeps tests deterministic.
 */
export function measureText(text: string, fontId: string, size: number): TextMetrics {
  const ctx = canvasContext();
  if (!ctx) return { width: text.length * size * 0.55, ascent: size * 0.7 };
  ctx.font = `${size}px "${fontFamily(fontId)}"`;
  const metrics = ctx.measureText(text);
  return { width: metrics.width, ascent: metrics.actualBoundingBoxAscent || size * 0.7 };
}
