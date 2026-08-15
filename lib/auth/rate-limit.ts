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
    const instance = createClient({ url: process.env.REDIS_URL });
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

export async function consumeAuthAttempt(key: string, limit = 8, windowMs = 15 * 60_000) {
  const client = await redisConnection().catch(() => null);
  if (client) {
    const redisKey = `bicuni:rate-limit:${key}`;
    const result = await client.multi().incr(redisKey).pExpire(redisKey, windowMs, "NX").exec();
    const count = Number(result[0]);
    return Number.isFinite(count) && count <= limit;
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
