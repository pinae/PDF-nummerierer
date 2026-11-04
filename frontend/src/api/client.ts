import { strings } from "../strings";

/** Any failed API call. `code` is stable for the UI; `message` is shown to people. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Sent as JSON. */
  json?: unknown;
  /** Sent as is, e.g. FormData for uploads. */
  body?: BodyInit;
  signal?: AbortSignal;
}

const CSRF_COOKIE = "csrftoken";

export function readCookie(name: string): string | undefined {
  for (const part of document.cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

/** The CSRF token from its cookie; asks the backend to set the cookie first if needed. */
export async function ensureCsrfToken(): Promise<string> {
  if (!readCookie(CSRF_COOKIE)) {
    await apiRequest("/api/csrf/");
  }
  return readCookie(CSRF_COOKIE) ?? "";
}

interface ErrorBody {
  error?: { code?: unknown; message?: unknown; fields?: unknown };
}

export function toApiError(status: number, data: unknown): ApiError {
  const error = (data as ErrorBody | undefined)?.error;
  if (error && typeof error.code === "string") {
    return new ApiError(
      status,
      error.code,
      typeof error.message === "string" ? error.message : strings.errors.server,
      (error.fields as Record<string, string[]> | undefined) ?? {},
    );
  }
  return new ApiError(status, "server_error", strings.errors.server);
}

/**
 * Call the backend (same origin). Mutating requests carry the CSRF token;
 * every failure, including network errors, is thrown as an ApiError.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers({ Accept: "application/json" });
  let body = options.body;
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }
  if (method !== "GET") {
    headers.set("X-CSRFToken", await ensureCsrfToken());
  }

  let response: Response;
  try {
    response = await fetch(new URL(path, window.location.href), {
      method,
      headers,
      body,
      credentials: "same-origin",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network_error", strings.errors.network);
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw toApiError(response.status, data);
  return data as T;
}
