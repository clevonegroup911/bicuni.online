import { createHash } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import { logger } from "@/lib/observability/logger";

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();
let redis: RedisClientType | undefined;
let connecting: Promise<RedisClientType> | undefined;

async function redisConnection() {
  if (!process.env.REDIS_URL) return null;
  if (redis?.isOpen) return redis;
  connecting ??= (async () => {
    const connectTimeout = positiveInteger(process.env.REDIS_CONNECT_TIMEOUT_MS, 750);
    const instance = createClient({
      url: process.env.REDIS_URL,
      socket: { connectTimeout, reconnectStrategy: (retries) => retries >= 2 ? false : Math.min(100 * 2 ** retries, 500) },
    });
    instance.on("error", (error) => logger.error("redis.rate_limit_error", error));
    await instance.connect();
    redis = instance as RedisClientType;
    return redis;
  })().catch((error) => {
    connecting = undefined;
    logger.error("redis.rate_limit_connection_error", error);
    throw error;
  });
  return connecting;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function rateLimitRedisKey(key: string) {
  const namespace = (process.env.REDIS_KEY_PREFIX || "bicuni").replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 40) || "bicuni";
  return `${namespace}:rate-limit:v1:${createHash("sha256").update(key).digest("hex")}`;
}

async function withTimeout<T>(operation: Promise<T>) {
  const timeoutMs = positiveInteger(process.env.REDIS_COMMAND_TIMEOUT_MS, 500);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Redis rate-limit timeout")), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function consumeAuthAttempt(key: string, limit = 8, windowMs = 15 * 60_000) {
  const client = await redisConnection().catch(() => null);
  if (client) {
    try {
      const redisKey = rateLimitRedisKey(key);
      const result = await withTimeout(client.multi().incr(redisKey).pExpire(redisKey, windowMs, "NX").exec());
      const count = Number(result[0]);
      if (Number.isFinite(count)) return count <= limit;
      logger.warn("redis.rate_limit_invalid_response");
    } catch (error) {
      logger.error("redis.rate_limit_command_error", error);
    }
  }

  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

export function requestIdentity(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}
