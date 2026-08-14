import { describe, expect, it } from "vitest";
import { toPublicPersistentIdentifier } from "./public";

describe("projection publique PID", () => {
  const base = {
    identifier: "bcu/2026.art.01K2R8M7H7YV5A0000000000",
    scheme: "BICUNI_PID" as const,
    resourceType: "DOCUMENT" as const,
    status: "ACTIVE" as const,
    targetUrl: "https://bicuni.online/documents/abc",
    createdAt: new Date("2026-08-13T10:00:00.000Z"),
    updatedAt: new Date("2026-08-13T11:00:00.000Z"),
    metadata: {
      title: "Article",
      internalNote: "secret-ops",
      actorEmail: "admin@example.com",
      ipHash: "abc",
      userAgent: "curl",
    },
  };

  it("expose le type public article sans champs administratifs", () => {
    const result = toPublicPersistentIdentifier(base);
    expect(result.resourceType).toBe("document");
    expect(result.targetUrl).toBe(base.targetUrl);
    expect(result.title).toBe("Article");
    expect(result).not.toHaveProperty("createdById");
    expect(result).not.toHaveProperty("prefix");
    expect(result).not.toHaveProperty("metadata");
  });

  it("n’expose pas un champ privé arbitraire de metadata", () => {
    const result = toPublicPersistentIdentifier(base);
    expect(JSON.stringify(result)).not.toMatch(/internalNote|actorEmail|ipHash|userAgent|secret-ops/);
    expect(result).not.toHaveProperty("internalNote");
    expect(result).not.toHaveProperty("actorEmail");
  });

  it("n’expose pas la destination d’un tombstone", () => {
    const result = toPublicPersistentIdentifier({ ...base, status: "TOMBSTONE" });
    expect(result.status).toBe("TOMBSTONE");
    expect(result).not.toHaveProperty("targetUrl");
  });
});
