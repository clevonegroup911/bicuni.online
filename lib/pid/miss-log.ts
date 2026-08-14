import { logger } from "../observability/logger";
import { PID_MAX_IDENTIFIER_LENGTH } from "./types";

const DEDUP_WINDOW_MS = 60_000;
const MAX_RECENT = 256;
const recentMisses = new Map<string, number>();

/** Déduplication locale des misses. Ce n’est pas une protection globale Cloud Run. */
export function logPidResolverMiss(event: "PID_NOT_FOUND", identifier: string) {
  const key = identifier.slice(0, PID_MAX_IDENTIFIER_LENGTH);
  const now = Date.now();
  const last = recentMisses.get(key);
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) return;
  if (recentMisses.size >= MAX_RECENT) {
    const oldest = recentMisses.keys().next().value;
    if (oldest) recentMisses.delete(oldest);
  }
  recentMisses.set(key, now);
  logger.warn(event, { identifier: key.slice(0, 80), sampled: true });
}

export function resetPidMissLogForTests() {
  recentMisses.clear();
}
