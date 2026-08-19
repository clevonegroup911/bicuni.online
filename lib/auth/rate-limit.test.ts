import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIpFromForwardedFor, consumeAuthAttempt, RateLimitUnavailableError, rateLimitRedisKey, requestIdentity } from "./rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.REDIS_URL;
  delete process.env.TRUSTED_PROXY_STRATEGY;
  delete process.env.K_SERVICE;
  delete process.env.REDIS_KEY_PREFIX;
});

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
  });

  it("refuse le repli Map en production lorsque Redis est absent", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.REDIS_URL;
    await expect(consumeAuthAttempt(`production:${crypto.randomUUID()}`, 8, 60_000)).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });
});

describe("requestIdentity", () => {
  it("ignore les adresses X-Forwarded-For fournies par le client sur Cloud Run", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRUSTED_PROXY_STRATEGY", "cloud-run");
    const request = new Request("https://bicuni.online/login", {
      headers: { "x-forwarded-for": "1.2.3.4, 9.9.9.9, 203.0.113.10" },
    });
    expect(requestIdentity(request, "production")).toBe("203.0.113.10");
    expect(clientIpFromForwardedFor("1.2.3.4, 9.9.9.9, 203.0.113.10", "cloud-run")).toBe("203.0.113.10");
  });

  it("traite le hop unique comme l’adresse observée par Cloud Run", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRUSTED_PROXY_STRATEGY", "cloud-run");
    const request = new Request("https://bicuni.online/login", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
        "x-real-ip": "8.8.8.8",
      },
    });
    expect(requestIdentity(request, "production")).toBe("203.0.113.10");
  });

  it("n’accorde aucune confiance à X-Real-IP en production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRUSTED_PROXY_STRATEGY", "cloud-run");
    const request = new Request("https://bicuni.online/login", {
      headers: { "x-real-ip": "198.51.100.1" },
    });
    expect(requestIdentity(request, "production")).toBe("unknown");
  });

  it("n’utilise pas X-Forwarded-For en stratégie loopback", () => {
    const request = new Request("http://127.0.0.1:3000/login", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "x-real-ip": "127.0.0.1",
      },
    });
    expect(requestIdentity(request, "development")).toBe("127.0.0.1");
    expect(clientIpFromForwardedFor("1.2.3.4, 203.0.113.10", "loopback")).toBeNull();
  });
});
