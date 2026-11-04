import { useEffect, useState } from "react";

import { listFonts } from "../api/endpoints";
import type { FontInfo } from "../api/types";

/** CSS font family under which a bundled font is registered for the preview. */
export const fontFamily = (fontId: string) => `pdfnum-${fontId}`;

const loading = new Map<string, Promise<void>>();

/** Register the same TTF the PDF output uses, so the preview shows the real glyphs. */
function loadFont(font: FontInfo): Promise<void> {
  if (typeof FontFace === "undefined" || typeof document === "undefined" || !document.fonts) {
    return Promise.resolve();
  }
  let promise = loading.get(font.id);
  if (!promise) {
    const face = new FontFace(fontFamily(font.id), `url(${font.url})`);
    promise = face.load().then(
      (loaded) => {
        document.fonts.add(loaded);
      },
      () => undefined,
    );
    loading.set(font.id, promise);
  }
  return promise;
}

/** The font list, and a counter that changes whenever another font finished loading. */
export function useFonts(): { fonts: FontInfo[]; loadedCount: number } {
  const [fonts, setFonts] = useState<FontInfo[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  useEffect(() => {
    let active = true;
    listFonts().then(
      (list) => {
        if (!active) return;
        setFonts(list);
        for (const font of list) {
          void loadFont(font).then(() => {
            if (active) setLoadedCount((count) => count + 1);
          });
        }
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, []);
  return { fonts, loadedCount };
}
