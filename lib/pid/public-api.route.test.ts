import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicByIdentifier: vi.fn(),
}));

vi.mock("@/lib/pid/service", () => ({
  PersistentIdentifierService: class {
    getPublicByIdentifier = mocks.getPublicByIdentifier;
  },
}));

import { PersistentIdentifierError } from "./errors";
import { GET } from "../../app/api/pids/[...identifier]/route";

describe("API publique /api/pids", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne les métadonnées publiques", async () => {
    mocks.getPublicByIdentifier.mockResolvedValue({
      identifier: "bcu/2026.art.01K2R8M7H7YV5A0000000000",
      scheme: "BICUNI_PID",
      resourceType: "article",
      status: "ACTIVE",
      targetUrl: "https://bicuni.online/documents/abc",
      createdAt: "2026-08-13T10:00:00.000Z",
      updatedAt: "2026-08-13T11:00:00.000Z",
      title: "Article",
    });
    const response = await GET(new Request("https://bicuni.online/api/pids/bcu/2026.art.01K2R8M7H7YV5A0000000000"), {
      params: Promise.resolve({ identifier: ["bcu", "2026.art.01K2R8M7H7YV5A0000000000"] }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.identifier).toMatch(/^bcu\//);
    expect(body).not.toHaveProperty("createdBy");
    expect(body).not.toHaveProperty("createdById");
    expect(body).not.toHaveProperty("metadata");
    expect(body).not.toHaveProperty("internalNote");
  });

  it("masque la destination d’un tombstone", async () => {
    mocks.getPublicByIdentifier.mockRejectedValue(new PersistentIdentifierError("Identifiant BICUNI introuvable.", 404));
    const response = await GET(new Request("https://bicuni.online/api/pids/missing"), {
      params: Promise.resolve({ identifier: ["missing"] }),
    });
    expect(response.status).toBe(404);
  });
});
