import { useCallback, useEffect, useState } from "react";

import { listFonts } from "../api/endpoints";
import type { FontInfo } from "../api/types";

/** CSS font family under which a bundled font is registered for the preview. */
export const fontFamily = (fontId: string) => `pdfnum-${fontId}`;

/** Fonts already requested, per document font set. */
const requested = new WeakMap<FontFaceSet, Map<string, Promise<void>>>();

/** Register the same TTF the PDF output uses, so the preview shows the real glyphs. */
function loadFont(font: FontInfo): Promise<void> {
  if (typeof FontFace === "undefined" || typeof document === "undefined" || !document.fonts) {
    return Promise.resolve();
  }
  let fonts = requested.get(document.fonts);
  if (!fonts) {
    fonts = new Map();
    requested.set(document.fonts, fonts);
  }
  let promise = fonts.get(font.id);
  if (!promise) {
    const face = new FontFace(fontFamily(font.id), `url(${font.url})`);
    promise = face.load().then(
      (loaded) => {
        document.fonts.add(loaded);
      },
      () => undefined,
    );
    fonts.set(font.id, promise);
  }
  return promise;
}

/**
 * The font list. Loads only the fonts in use (the TTFs are about 4 MB
 * together); `loadAll` fetches the rest, e.g. when the font menu opens.
 * `loadedCount` changes whenever a font finished loading, to re-measure text.
 */
export function useFonts(inUse: string[]): {
  fonts: FontInfo[];
  loadedCount: number;
  loadAll: () => void;
} {
  const [fonts, setFonts] = useState<FontInfo[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  useEffect(() => {
    let active = true;
    listFonts().then(
      (list) => active && setFonts(list),
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, []);

  const wanted = [...new Set(inUse)].sort().join(",");
  useEffect(() => {
    let active = true;
    for (const font of fonts) {
      if (!wanted.split(",").includes(font.id)) continue;
      void loadFont(font).then(() => active && setLoadedCount((count) => count + 1));
    }
    return () => {
      active = false;
    };
  }, [fonts, wanted]);

  const loadAll = useCallback(() => {
    for (const font of fonts) void loadFont(font).then(() => setLoadedCount((count) => count + 1));
  }, [fonts]);

  return { fonts, loadedCount, loadAll };
}
