const BYTE_UNITS = ["KB", "MB", "GB", "TB"];

function oneDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

/** 524288000 → "500 MB" (binary units, as the backend computes its limits). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${oneDecimal(value)} ${BYTE_UNITS[unit]}`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** 7200 → "2 hours", 5400 → "90 minutes". */
export function formatDuration(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) return plural(seconds / 3600, "hour");
  if (seconds >= 60 && seconds % 60 === 0) return plural(seconds / 60, "minute");
  return plural(seconds, "second");
}
