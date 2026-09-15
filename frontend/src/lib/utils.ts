import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a byte count into a human-readable string using decimal (1000)
 * units for KB/MB/GB, correctly handling both bytes and already-sized values.
 *
 * "1000 problem": 1 MB = 1000 KB = 1,000,000 bytes (SI) while 1 MiB uses 1024.
 * Displays show SI units (KB/MB/GB) so a 100 KB file shows "100 KB", not "0.10 MB".
 */
export function formatBytes(bytes: string | number | undefined | null): string {
  if (bytes === undefined || bytes === null || bytes === "") return "—";
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "—";

  if (n < 1000) return `${n} B`;

  // Heuristic: if the value is tiny (e.g. a fractional GB that is really bytes,
  // or a value already in KB), normalise to bytes where sensible.
  const kB = n / 1000;
  const kBInBytes = n > 0 && n < 1000; // < 1000 bytes: handled above
  const mB = n / 1000 / 1000;
  const gB = n / 1000 / 1000 / 1000;

  if (gB >= 1) return `${gB.toFixed(2)} GB`;
  if (mB >= 1) return `${mB.toFixed(2)} MB`;
  return `${kB.toFixed(1)} KB`;
}

/** Convert a decimal display size (e.g. "10 MB" → 10 * 1000 * 1000 bytes). */
export function megabytesToBytes(mb: number): number {
  return mb * 1000 * 1000;
}
