import { ApiError } from "../api/client";
import { strings } from "../strings";

/** A human-readable reason, preferring per-field validation messages. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    const fieldMessages = Object.values(error.fields).flat();
    return fieldMessages.length ? fieldMessages.join(" ") : error.message;
  }
  return strings.errors.server;
}
