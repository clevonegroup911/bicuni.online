import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class PersistentIdentifierError extends Error {
    constructor(message: string, readonly status = 400) {
      super(message);
    }
  }
  return {
    auth: vi.fn(),
    findUnique: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
    updateTarget: vi.fn(),
    deprecate: vi.fn(),
    tombstone: vi.fn(),
    history: vi.fn(),
    PersistentIdentifierError,
  };
});

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("../db/client", () => ({ db: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/db/client", () => ({ db: { user: { findUnique: mocks.findUnique } } }));
vi.mock("./service", () => ({
  PersistentIdentifierService: class {
    list = mocks.list;
    create = mocks.create;
    getById = mocks.getById;
    updateTarget = mocks.updateTarget;
    deprecate = mocks.deprecate;
    tombstone = mocks.tombstone;
    history = mocks.history;
  },
}));
vi.mock("@/lib/pid/service", () => ({
  PersistentIdentifierService: class {
    list = mocks.list;
    create = mocks.create;
    getById = mocks.getById;
    updateTarget = mocks.updateTarget;
    deprecate = mocks.deprecate;
    tombstone = mocks.tombstone;
    history = mocks.history;
  },
}));

import { PersistentIdentifierError } from "./errors";
import { GET as listGET, POST } from "../../app/api/admin/pids/route";
import { GET as detailGET, PATCH } from "../../app/api/admin/pids/[id]/route";
import { GET as historyGET } from "../../app/api/admin/pids/[id]/history/route";

const validId = "cm12345678901234567890123";

describe("API admin PID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 });
  });

  it("refuse un visiteur anonyme", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await listGET(new Request("https://bicuni.online/api/admin/pids"))).status).toBe(401);
  });

  it("refuse un USER", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "user" } });
    mocks.findUnique.mockResolvedValue({ id: "user", role: "USER", status: "ACTIVE" });
    expect((await listGET(new Request("https://bicuni.online/api/admin/pids"))).status).toBe(403);
  });

  it("autorise la lecture à un MODERATOR mais refuse la création", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "mod" } });
    mocks.findUnique.mockResolvedValue({ id: "mod", role: "MODERATOR", status: "ACTIVE" });
    expect((await listGET(new Request("https://bicuni.online/api/admin/pids"))).status).toBe(200);
    const created = await POST(new Request("https://bicuni.online/api/admin/pids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resourceType: "document",
        suffixType: "art",
        resourceId: validId,
        targetUrl: "https://bicuni.online/documents/x",
      }),
    }));
    expect(created.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("crée un PID pour un ADMIN", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin" } });
    mocks.findUnique.mockResolvedValue({ id: "admin", role: "ADMIN", status: "ACTIVE" });
    mocks.create.mockResolvedValue({ identifier: "bcu/2026.art.TEST", resolverUrl: "https://bicuni.online/pid/bcu/2026.art.TEST" });
    const response = await POST(new Request("https://bicuni.online/api/admin/pids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resourceType: "document",
        suffixType: "art",
        resourceId: validId,
        targetUrl: "https://bicuni.online/documents/cm12345678901234567890123",
      }),
    }));
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      resourceType: "DOCUMENT",
      suffixType: "ART",
      resourceId: validId,
    }), expect.anything());
  });

  it("refuse resourceId null ou DOCUMENT comme suffixType", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin" } });
    mocks.findUnique.mockResolvedValue({ id: "admin", role: "ADMIN", status: "ACTIVE" });
    const missing = await POST(new Request("https://bicuni.online/api/admin/pids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resourceType: "DOCUMENT",
        suffixType: "ART",
        resourceId: null,
        targetUrl: "https://bicuni.online/documents/cm12345678901234567890123",
      }),
    }));
    expect(missing.status).toBe(400);
    const suffix = await POST(new Request("https://bicuni.online/api/admin/pids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resourceType: "DOCUMENT",
        suffixType: "DOCUMENT",
        resourceId: validId,
        targetUrl: "https://bicuni.online/documents/cm12345678901234567890123",
      }),
    }));
    expect(suffix.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejette ART comme resourceType sans conversion silencieuse", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin" } });
    mocks.findUnique.mockResolvedValue({ id: "admin", role: "ADMIN", status: "ACTIVE" });
    const response = await POST(new Request("https://bicuni.online/api/admin/pids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resourceType: "art", targetUrl: "https://bicuni.online/documents/cm12345678901234567890123" }),
    }));
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejette une tentative de modification de l’identifiant", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin" } });
    mocks.findUnique.mockResolvedValue({ id: "admin", role: "ADMIN", status: "ACTIVE" });
    const response = await PATCH(
      new Request(`https://bicuni.online/api/admin/pids/${validId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "updateTarget",
          targetUrl: "https://bicuni.online/library/new",
          identifier: "bcu/tampered",
        }),
      }),
      { params: Promise.resolve({ id: validId }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.updateTarget).not.toHaveBeenCalled();
  });

  it("expose l’historique aux lecteurs autorisés", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "mod" } });
    mocks.findUnique.mockResolvedValue({ id: "mod", role: "MODERATOR", status: "ACTIVE" });
    mocks.history.mockResolvedValue({ items: [], limit: 20, nextCursor: null });
    const response = await historyGET(new Request(`https://bicuni.online/api/admin/pids/${validId}/history`), {
      params: Promise.resolve({ id: validId }),
    });
    expect(response.status).toBe(200);
    expect(mocks.history).toHaveBeenCalledWith(validId, { id: "mod", role: "MODERATOR" }, expect.objectContaining({ limit: 20 }));
  });

  it("demande le détail avec l’acteur authentifié et masque un PID hors périmètre", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "ia" } });
    mocks.findUnique.mockResolvedValue({ id: "ia", role: "INSTITUTION_ADMIN", status: "ACTIVE" });
    mocks.getById.mockRejectedValue(new PersistentIdentifierError("Identifiant BICUNI introuvable.", 404));
    const response = await detailGET(new Request(`https://bicuni.online/api/admin/pids/${validId}`), {
      params: Promise.resolve({ id: validId }),
    });
    expect(response.status).toBe(404);
    expect(mocks.getById).toHaveBeenCalledWith(validId, { id: "ia", role: "INSTITUTION_ADMIN" });
    const body = await response.json();
    expect(body.error).toBe("Identifiant BICUNI introuvable.");
    expect(JSON.stringify(body)).not.toMatch(/targetUrl|metadata|identifier/);
  });

  it("refuse une limite d’historique supérieure à 50", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin" } });
    mocks.findUnique.mockResolvedValue({ id: "admin", role: "ADMIN", status: "ACTIVE" });
    const response = await historyGET(new Request(`https://bicuni.online/api/admin/pids/${validId}/history?limit=51`), {
      params: Promise.resolve({ id: validId }),
    });
    expect(response.status).toBe(400);
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("retourne 404 pour un id non cuid", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "admin" } });
    mocks.findUnique.mockResolvedValue({ id: "admin", role: "ADMIN", status: "ACTIVE" });
    const response = await detailGET(new Request("https://bicuni.online/api/admin/pids/not-an-id"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(response.status).toBe(404);
    expect(mocks.getById).not.toHaveBeenCalled();
  });
});
