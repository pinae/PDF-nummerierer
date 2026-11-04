import { useCallback, useEffect, useState } from "react";

import { listConfigs } from "../api/endpoints";
import type { NumberingConfig } from "../api/types";

export interface ConfigList {
  configs: NumberingConfig[];
  loaded: boolean;
  failed: boolean;
  reload: () => void;
}

/** Latest version of every saved configuration. */
export function useConfigs(): ConfigList {
  const [state, setState] = useState({
    configs: [] as NumberingConfig[],
    loaded: false,
    failed: false,
  });
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let active = true;
    listConfigs().then(
      (configs) => active && setState({ configs, loaded: true, failed: false }),
      () => active && setState((current) => ({ ...current, loaded: true, failed: true })),
    );
    return () => {
      active = false;
    };
  }, [generation]);
  const reload = useCallback(() => setGeneration((value) => value + 1), []);
  return { ...state, reload };
}
