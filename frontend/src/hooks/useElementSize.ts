import { useCallback, useEffect, useState } from "react";

import type { Size } from "../pdf/coordinates";

/** Callback ref plus the element's current content size (0 × 0 until measured). */
export function useElementSize<T extends HTMLElement>(): [(element: T | null) => void, Size] {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const ref = useCallback((node: T | null) => setElement(node), []);

  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [ref, size];
}
