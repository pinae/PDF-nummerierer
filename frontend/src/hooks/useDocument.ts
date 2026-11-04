import { useEffect, useState } from "react";

import { ApiError } from "../api/client";
import { getDocument } from "../api/endpoints";
import type { DocumentInfo } from "../api/types";

export type DocumentState =
  | { status: "loading" }
  | { status: "ready"; document: DocumentInfo }
  | { status: "missing" }
  | { status: "error"; message: string };

/** Metadata of an uploaded exam. Remount (e.g. via `key`) to load another one. */
export function useDocument(documentId: string): DocumentState {
  const [state, setState] = useState<DocumentState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    getDocument(documentId).then(
      (document) => {
        if (active) setState({ status: "ready", document });
      },
      (error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 404) setState({ status: "missing" });
        else setState({ status: "error", message: (error as Error).message });
      },
    );
    return () => {
      active = false;
    };
  }, [documentId]);
  return state;
}
