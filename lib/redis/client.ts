import { createClient, type RedisClientType } from "redis";
import { logger } from "@/lib/observability/logger";

let client: RedisClientType | undefined;
let connecting: Promise<RedisClientType> | undefined;
let connectedUrl: string | undefined;

export async function sharedRedisClient(): Promise<RedisClientType | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (client?.isOpen && connectedUrl === url) return client;
  if (connecting && connectedUrl === url) return connecting;

  if (client?.isOpen && connectedUrl !== url) await closeSharedRedisClient();
  connectedUrl = url;
  const instance = createClient({
    url,
    socket: {
      connectTimeout: positiveInteger(process.env.REDIS_CONNECT_TIMEOUT_MS, 750),
      reconnectStrategy: (retries) => retries >= 2 ? false : Math.min(100 * 2 ** retries, 500),
    },
  });
  instance.on("error", (error) => logger.error("redis.shared_error", error));
  connecting = instance.connect()
    .then(() => {
      client = instance as RedisClientType;
      return client;
    })
    .catch((error) => {
      connectedUrl = undefined;
      instance.destroy();
      logger.error("redis.shared_connection_error", error);
      throw error;
    })
    .finally(() => {
      connecting = undefined;
    });
  return connecting;
}

export async function closeSharedRedisClient() {
  const active = client;
  client = undefined;
  connecting = undefined;
  connectedUrl = undefined;
  if (!active?.isOpen) return;
  await active.quit().catch(() => active.destroy());
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
