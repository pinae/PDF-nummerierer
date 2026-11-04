import { useEffect, useState } from "react";

import { getLimits } from "../api/endpoints";
import type { Limits } from "../api/types";

/** Server limits, or null while loading or when they cannot be loaded. */
export function useLimits(): Limits | null {
  const [limits, setLimits] = useState<Limits | null>(null);
  useEffect(() => {
    let active = true;
    getLimits().then(
      (loaded) => {
        if (active) setLimits(loaded);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, []);
  return limits;
}
