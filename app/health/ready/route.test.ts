import { beforeEach, describe, expect, it, vi } from "vitest";

const readinessReport = vi.hoisted(() => vi.fn());

vi.mock("@/lib/health/checks", () => ({ readinessReport }));

import { GET } from "./route";

describe("GET /health/ready", () => {
  beforeEach(() => vi.clearAllMocks());

  it("répond 200 lorsque les dépendances indispensables sont disponibles", async () => {
    readinessReport.mockResolvedValue({
      ready: true,
      dependencies: { database: "ok", redis: "ok" },
    });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      check: "ready",
      dependencies: { database: "ok", redis: "ok" },
    });
  });

  it("répond 503 sans exposer de secret lorsque la base est indisponible", async () => {
    readinessReport.mockResolvedValue({
      ready: false,
      dependencies: { database: "unavailable", redis: "skipped" },
    });
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({
      status: "unavailable",
      check: "ready",
      dependencies: { database: "unavailable", redis: "skipped" },
    });
    expect(JSON.stringify(body)).not.toMatch(/postgres|password|redis:\/\//i);
  });
});
