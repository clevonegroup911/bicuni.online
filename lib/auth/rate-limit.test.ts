import { describe, expect, it } from "vitest";
import { consumeAuthAttempt, rateLimitRedisKey } from "./rate-limit";

describe("consumeAuthAttempt", () => {
  it("applique la limite locale lorsque Redis n’est pas configuré", async () => {
    const key = `test:${crypto.randomUUID()}`;
    await expect(consumeAuthAttempt(key, 2, 60_000)).resolves.toBe(true);
    await expect(consumeAuthAttempt(key, 2, 60_000)).resolves.toBe(true);
    await expect(consumeAuthAttempt(key, 2, 60_000)).resolves.toBe(false);
  });

  it("namespaces et hache les identifiants avant Redis", () => {
    process.env.REDIS_KEY_PREFIX = "bicuni-prod";
    const key = rateLimitRedisKey("forgot:203.0.113.10:user@example.test");
    expect(key).toMatch(/^bicuni-prod:rate-limit:v1:[a-f0-9]{64}$/);
    expect(key).not.toContain("example.test");
    delete process.env.REDIS_KEY_PREFIX;
  });
});
