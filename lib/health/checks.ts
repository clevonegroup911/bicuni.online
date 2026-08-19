import { createClient } from "redis";
import { db } from "@/lib/db/client";

const DEFAULT_TIMEOUT_MS = 2_000;

export type DependencyStatus = "ok" | "unavailable" | "skipped";

export type ReadinessReport = {
  ready: boolean;
  dependencies: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
};

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Readiness check timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function checkDatabaseReadiness(
  query: () => Promise<unknown> = () => db.$queryRaw`SELECT 1`,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  try {
    await withTimeout(query(), timeoutMs);
    return true;
  } catch {
    return false;
  }
}

export async function checkRedisReadiness(
  ping: () => Promise<unknown> = pingConfiguredRedis,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  try {
    await withTimeout(ping(), timeoutMs);
    return true;
  } catch {
    return false;
  }
}

async function pingConfiguredRedis() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error("REDIS_URL is not configured.");
  const connectTimeout = Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 750;
  const client = createClient({ url, socket: { connectTimeout, reconnectStrategy: false } });
  try {
    await client.connect();
    await client.ping();
  } finally {
    await client.quit().catch(() => undefined);
  }
}

export function redisRequiredForReadiness(environment: string | undefined = process.env.NODE_ENV) {
  return environment === "production" || Boolean(process.env.REDIS_URL?.trim());
}

export async function readinessReport(input: {
  environment?: string;
  database?: () => Promise<boolean>;
  redis?: () => Promise<boolean>;
} = {}): Promise<ReadinessReport> {
  const environment = input.environment ?? process.env.NODE_ENV;
  const databaseOk = await (input.database ?? (() => checkDatabaseReadiness()))();
  let redis: DependencyStatus = "skipped";
  if (redisRequiredForReadiness(environment)) {
    const redisOk = process.env.REDIS_URL?.trim()
      ? await (input.redis ?? (() => checkRedisReadiness()))()
      : false;
    redis = redisOk ? "ok" : "unavailable";
  }
  return {
    ready: databaseOk && redis !== "unavailable",
    dependencies: {
      database: databaseOk ? "ok" : "unavailable",
      redis,
    },
  };
}
