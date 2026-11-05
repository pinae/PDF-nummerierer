import { useEffect } from "react";

import { keepAlive } from "../api/endpoints";
import { timing } from "../generation/timing";

/**
 * While a page shows an uploaded exam, tell the server regularly that it is
 * still in use. When the browser is closed the keep-alives stop and the server
 * deletes the abandoned upload after its idle limit. Pass null to stop.
 */
export function useKeepAlive(documentId: string | null): void {
  useEffect(() => {
    if (!documentId) return;
    const send = () => void keepAlive(documentId).catch(() => undefined);
    send();
    const timer = setInterval(send, timing.keepAliveMs);
    return () => clearInterval(timer);
  }, [documentId]);
}
