import type { NumberFormat } from "../api/types";

/** prefix + zero-padded number + suffix, exactly like the backend's format_serial. */
export function formatSerial(format: NumberFormat, number: number): string {
  return `${format.prefix}${String(number).padStart(format.digits, "0")}${format.suffix}`;
}
