import { afterEach, describe, expect, it, vi } from "vitest";
import { checkDatabaseReadiness, checkRedisReadiness, readinessReport, redisRequiredForReadiness } from "./checks";

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.REDIS_URL;
});

describe("checkDatabaseReadiness", () => {
  it("accepte une requête PostgreSQL réussie", async () => {
    await expect(checkDatabaseReadiness(async () => 1)).resolves.toBe(true);
  });

  it("échoue sans exposer l’erreur de connexion", async () => {
    await expect(checkDatabaseReadiness(async () => {
      throw new Error("postgresql://secret@database.example/bicuni");
    })).resolves.toBe(false);
  });

  it("borne le temps de la vérification", async () => {
    await expect(checkDatabaseReadiness(() => new Promise(() => undefined), 20)).resolves.toBe(false);
  }, 1000);
});

describe("checkRedisReadiness", () => {
  it("échoue de manière bornée sans renvoyer l’URL Redis", async () => {
    await expect(checkRedisReadiness(async () => {
      throw new Error("redis://secret@redis.example:6379/0");
    })).resolves.toBe(false);
  });
});

describe("readinessReport", () => {
  it("exige Redis en production même s’il n’est pas configuré", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.REDIS_URL;
    const report = await readinessReport({
      environment: "production",
      database: async () => true,
    });
    expect(redisRequiredForReadiness("production")).toBe(true);
    expect(report.ready).toBe(false);
    expect(report.dependencies).toEqual({ database: "ok", redis: "unavailable" });
    expect(JSON.stringify(report)).not.toMatch(/secret|redis:\/\//i);
  });

  it("ignore Redis en développement lorsqu’il n’est pas configuré", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.REDIS_URL;
    const report = await readinessReport({
      environment: "development",
      database: async () => true,
    });
    expect(report.ready).toBe(true);
    expect(report.dependencies.redis).toBe("skipped");
  });
});
