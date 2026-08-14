import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
}));

vi.mock("@/lib/pid/service", () => ({
  PersistentIdentifierService: class {
    resolve = mocks.resolve;
  },
}));

import { GET } from "../../app/pid/[prefix]/[...suffix]/route";

describe("résolveur public /pid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirige en 302 vers la destination", async () => {
    mocks.resolve.mockResolvedValue({
      outcome: "redirect",
      identifier: "bcu/2026.art.01K2R8M7H7YV5A0000000000",
      targetUrl: "https://bicuni.online/documents/abc",
      status: "ACTIVE",
    });
    const response = await GET(new Request("https://bicuni.online/pid/bcu/2026.art.01K2R8M7H7YV5A0000000000"), {
      params: Promise.resolve({ prefix: "bcu", suffix: ["2026.art.01K2R8M7H7YV5A0000000000"] }),
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://bicuni.online/documents/abc");
  });

  it("retourne 404 pour un identifiant inconnu", async () => {
    mocks.resolve.mockResolvedValue({
      outcome: "not_found",
      identifier: "bcu/2026.art.01K2R8M7H7YV5A0000000000",
    });
    const response = await GET(new Request("https://bicuni.online/pid/bcu/2026.art.01K2R8M7H7YV5A0000000000"), {
      params: Promise.resolve({ prefix: "bcu", suffix: ["2026.art.01K2R8M7H7YV5A0000000000"] }),
    });
    expect(response.status).toBe(404);
    expect(await response.text()).toMatch(/Identifiant BICUNI introuvable/);
  });

  it("retourne 410 pour un tombstone", async () => {
    mocks.resolve.mockResolvedValue({
      outcome: "gone",
      identifier: "bcu/2026.art.01K2R8M7H7YV5A0000000000",
    });
    const response = await GET(new Request("https://bicuni.online/pid/bcu/2026.art.01K2R8M7H7YV5A0000000000"), {
      params: Promise.resolve({ prefix: "bcu", suffix: ["2026.art.01K2R8M7H7YV5A0000000000"] }),
    });
    expect(response.status).toBe(410);
    expect(await response.text()).toMatch(/n’est plus disponible/);
  });

  it("retourne 400 pour un identifiant malformé", async () => {
    const response = await GET(new Request("https://bicuni.online/pid/bcu/..%2fsecret"), {
      params: Promise.resolve({ prefix: "bcu", suffix: ["../secret"] }),
    });
    expect(response.status).toBe(400);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("rejette un préfixe 10.x avant toute résolution", async () => {
    const response = await GET(new Request("https://bicuni.online/pid/10.12345/article.x"), {
      params: Promise.resolve({ prefix: "10.12345", suffix: ["article.x"] }),
    });
    expect(response.status).toBe(400);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });

  it("rejette 10.bcu avant toute résolution", async () => {
    const response = await GET(new Request("https://bicuni.online/pid/10.bcu/2026.art.01K2R8M7H7YV5A0000000000"), {
      params: Promise.resolve({ prefix: "10.bcu", suffix: ["2026.art.01K2R8M7H7YV5A0000000000"] }),
    });
    expect(response.status).toBe(400);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
});
