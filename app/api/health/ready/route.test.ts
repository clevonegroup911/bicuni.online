import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const readiness = vi.hoisted(() => vi.fn());

vi.mock("@/lib/health/http", () => ({ readyResponse: readiness }));

afterEach(() => readiness.mockReset());

describe("GET /api/health/ready", () => {
  it("répond 503 sans PostgreSQL ni Redis disponibles", async () => {
    readiness.mockResolvedValue(NextResponse.json(
      {
        status: "unavailable",
        check: "ready",
        dependencies: { database: "unavailable", redis: "unavailable" },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    ));
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "unavailable",
      check: "ready",
      dependencies: { database: "unavailable", redis: "unavailable" },
    });
  });
});
