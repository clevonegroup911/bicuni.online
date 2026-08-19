import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient, type RedisClientType } from "redis";
import { logger } from "@/lib/observability/logger";

export class RateLimitUnavailableError extends Error {
  readonly status = 503 as const;
  constructor() {
    super("Distributed rate limiting is unavailable.");
    this.name = "RateLimitUnavailableError";
  }
}

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();
let redis: RedisClientType | undefined;
let connecting: Promise<RedisClientType> | undefined;

export type TrustedProxyStrategy = "cloud-run" | "loopback";

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

export function distributedRateLimitRequired(environment = process.env.NODE_ENV) {
  return environment === "production";
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

  if (distributedRateLimitRequired()) {
    logger.error("redis.rate_limit_unavailable", new Error("Distributed rate limiting is required in production."));
    throw new RateLimitUnavailableError();
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

export function trustedProxyStrategy(environment = process.env.NODE_ENV): TrustedProxyStrategy {
  const configured = process.env.TRUSTED_PROXY_STRATEGY?.trim().toLowerCase();
  if (configured === "cloud-run" || configured === "loopback") return configured;
  if (process.env.K_SERVICE || environment === "production") return "cloud-run";
  return "loopback";
}

export function clientIpFromForwardedFor(
  forwardedFor: string | null,
  strategy: TrustedProxyStrategy = trustedProxyStrategy(),
) {
  const forwarded = forwardedFor
    ?.split(",")
    .map((address) => address.trim())
    .filter(Boolean) ?? [];
  if (strategy === "cloud-run") {
    // Cloud Run / GFE appends the connecting client as the last hop. Leading values are client-supplied.
    return forwarded.at(-1) ?? null;
  }
  return null;
}

export function requestIdentity(request: Request, environment = process.env.NODE_ENV) {
  const strategy = trustedProxyStrategy(environment);
  const forwardedIp = clientIpFromForwardedFor(request.headers.get("x-forwarded-for"), strategy);
  if (forwardedIp) return forwardedIp;
  if (strategy !== "cloud-run" && environment !== "production") {
    return request.headers.get("x-real-ip")?.trim() || "unknown";
  }
  return "unknown";
}

export async function denyIfRateLimited(
  key: string,
  limit?: number,
  windowMs?: number,
  onLimited: () => NextResponse = () => NextResponse.json({ error: "Trop de requêtes." }, { status: 429 }),
) {
  try {
    if (!await consumeAuthAttempt(key, limit, windowMs)) return onLimited();
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 503 });
    }
    throw error;
  }
  return null;
}
