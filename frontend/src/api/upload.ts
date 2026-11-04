import { strings } from "../strings";
import { ApiError, ensureCsrfToken, toApiError } from "./client";
import type { DocumentInfo } from "./types";

export interface UploadOptions {
  /** Called with 0..1 while the file is being sent. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  /** For tests. */
  createRequest?: () => XMLHttpRequest;
}

/**
 * Upload a PDF with progress reporting (fetch cannot report upload progress,
 * so this uses XMLHttpRequest). Rejects with ApiError, or an AbortError when
 * cancelled through `signal`.
 */
export async function uploadDocument(
  file: File,
  options: UploadOptions = {},
): Promise<DocumentInfo> {
  const token = await ensureCsrfToken();
  return new Promise((resolve, reject) => {
    const { signal, onProgress } = options;
    if (signal?.aborted) {
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    const request = (options.createRequest ?? (() => new XMLHttpRequest()))();
    const abort = () => request.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const settle = () => signal?.removeEventListener("abort", abort);

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    });
    request.addEventListener("load", () => {
      settle();
      let data: unknown;
      try {
        data = JSON.parse(request.responseText);
      } catch {
        data = undefined;
      }
      if (request.status >= 200 && request.status < 300) resolve(data as DocumentInfo);
      else reject(toApiError(request.status, data));
    });
    request.addEventListener("error", () => {
      settle();
      reject(new ApiError(0, "network_error", strings.errors.network));
    });
    request.addEventListener("abort", () => {
      settle();
      reject(new DOMException("Upload cancelled", "AbortError"));
    });

    request.open("POST", "/api/documents/");
    request.setRequestHeader("Accept", "application/json");
    request.setRequestHeader("X-CSRFToken", token);
    const form = new FormData();
    form.append("file", file);
    request.send(form);
  });
}
