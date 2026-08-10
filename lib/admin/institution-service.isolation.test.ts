import { Prisma } from "@prisma/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  findMany,
  findUnique,
  create,
  update,
  auditFindMany,
  auditCreate,
  count,
  transaction,
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  auditFindMany: vi.fn(),
  auditCreate: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../db/client", () => ({
  db: {
    university: { findMany, findUnique, create, update, count },
    auditLog: { create: auditCreate, findMany: auditFindMany },
    $transaction: transaction,
  },
}));

import {
  AdminInstitutionError,
  AdminInstitutionService,
  INSTITUTION_LIST_ORDER,
} from "./institution-service";

const context = { ipHash: "hash", userAgent: "vitest" };
const stamped = new Date("2026-01-01T00:00:00.000Z");

function institution(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Institution ${id}`,
    acronym: null,
    slug: id,
    type: "UNIVERSITY",
    country: "CD",
    province: null,
    city: null,
    address: null,
    website: null,
    domain: null,
    logoUrl: null,
    status: "ACTIVE",
    createdAt: stamped,
    updatedAt: stamped,
    ...overrides,
  };
}

describe("AdminInstitutionService isolation et mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (callbackOrQueries: unknown) => {
      if (typeof callbackOrQueries === "function") {
        return (callbackOrQueries as (tx: unknown) => unknown)({
          university: { create, update, findUnique },
          auditLog: { create: auditCreate },
        });
      }
      return Promise.all(callbackOrQueries as Promise<unknown>[]);
    });
  });

  it("list() d’un INSTITUTION_ADMIN ne retourne que son institution", async () => {
    findMany
      .mockResolvedValueOnce([{ id: "uni-1" }])
      .mockResolvedValueOnce([institution("uni-1", { _count: { profiles: 1, documents: 0, admins: 1 } })]);
    count.mockResolvedValue(1);

    const service = new AdminInstitutionService();
    const result = await service.list({
      actorId: "ia",
      actorRole: "INSTITUTION_ADMIN",
      q: "",
      page: 1,
    });

    expect(result.institutions.map((item) => item.id)).toEqual(["uni-1"]);
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["uni-1"] } }),
        orderBy: INSTITUTION_LIST_ORDER,
      }),
    );
  });

  it("GET autre institution : refusé", async () => {
    findMany.mockResolvedValue([{ id: "uni-1" }]);
    const service = new AdminInstitutionService();
    await expect(service.getById("ia", "INSTITUTION_ADMIN", "uni-2")).rejects.toThrow(/Accès refusé/);
  });

  it("peut consulter son institution sans AuditLog brut", async () => {
    findMany.mockResolvedValue([{ id: "uni-1" }]);
    findUnique.mockResolvedValue({
      ...institution("uni-1"),
      admins: [],
      profiles: [],
      documents: [],
      _count: { profiles: 0, documents: 0, admins: 0, faculties: 0 },
    });
    auditFindMany.mockResolvedValue([{ id: "audit-secret", action: "INSTITUTION_UPDATED" }]);

    const service = new AdminInstitutionService();
    const result = await service.getById("ia", "INSTITUTION_ADMIN", "uni-1");

    expect(result.id).toBe("uni-1");
    expect(result.auditLogs).toEqual([]);
    expect(result.auditLogsVisible).toBe(false);
    expect(auditFindMany).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN peut lire les AuditLog de l’institution", async () => {
    findUnique.mockResolvedValue({
      ...institution("uni-1"),
      admins: [],
      profiles: [],
      documents: [],
      _count: { profiles: 0, documents: 0, admins: 0, faculties: 0 },
    });
    auditFindMany.mockResolvedValue([{ id: "audit-1", action: "INSTITUTION_UPDATED", createdAt: stamped, actor: null }]);

    const service = new AdminInstitutionService();
    const result = await service.getById("root", "SUPER_ADMIN", "uni-1");

    expect(result.auditLogsVisible).toBe(true);
    expect(result.auditLogs).toHaveLength(1);
    expect(auditFindMany).toHaveBeenCalled();
  });

  it("PATCH de son institution : autorisé pour INSTITUTION_ADMIN", async () => {
    findMany.mockResolvedValue([{ id: "uni-1" }]);
    const current = institution("uni-1", { name: "Ancien", slug: "ancien" });
    findUnique.mockResolvedValueOnce(current).mockResolvedValueOnce(null);
    update.mockResolvedValue({ ...current, name: "Nouveau", slug: "nouveau" });
    auditCreate.mockResolvedValue({});

    const service = new AdminInstitutionService();
    const result = await service.update(
      "ia",
      "INSTITUTION_ADMIN",
      "uni-1",
      { name: "Nouveau", slug: "nouveau", type: "UNIVERSITY", country: "CD" },
      context,
    );

    expect(result.name).toBe("Nouveau");
  });

  it("PATCH autre institution : refusé", async () => {
    findMany.mockResolvedValue([{ id: "uni-1" }]);
    const service = new AdminInstitutionService();
    await expect(
      service.update(
        "ia",
        "INSTITUTION_ADMIN",
        "uni-2",
        { name: "X", slug: "x", type: "UNIVERSITY", country: "CD" },
        context,
      ),
    ).rejects.toThrow(/Accès refusé/);
  });

  it("changement de statut par INSTITUTION_ADMIN : refusé", async () => {
    const service = new AdminInstitutionService();
    await expect(
      service.changeStatus("ia", "INSTITUTION_ADMIN", "uni-1", "SUSPENDED", context),
    ).rejects.toThrow(/changer le statut/);
  });

  it("crée une institution avec AuditLog", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue(institution("uni-new", { name: "UNIKIN", acronym: "UNIKIN", slug: "unikin", status: "PENDING", city: "Kinshasa" }));
    auditCreate.mockResolvedValue({});

    const service = new AdminInstitutionService();
    const result = await service.create(
      "root",
      "SUPER_ADMIN",
      { name: "UNIKIN", acronym: "UNIKIN", slug: "unikin", type: "UNIVERSITY", country: "CD", city: "Kinshasa" },
      context,
    );

    expect(result.id).toBe("uni-new");
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "INSTITUTION_CREATED", entityType: "University" }),
      }),
    );
  });

  it("refuse la création par INSTITUTION_ADMIN", async () => {
    const service = new AdminInstitutionService();
    await expect(
      service.create("ia", "INSTITUTION_ADMIN", { name: "X", slug: "x", type: "UNIVERSITY", country: "CD" }, context),
    ).rejects.toBeInstanceOf(AdminInstitutionError);
  });

  it("traduit P2002 slug en conflit métier 409", async () => {
    findUnique.mockResolvedValue(null);
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["slug"] },
    });
    transaction.mockRejectedValue(p2002);

    const service = new AdminInstitutionService();
    await expect(
      service.create("root", "SUPER_ADMIN", { name: "UNIKIN", slug: "unikin", type: "UNIVERSITY", country: "CD" }, context),
    ).rejects.toMatchObject({ message: expect.stringMatching(/slug/), status: 409 });
  });

  it("applique un orderBy stable même si plusieurs institutions partagent createdAt", async () => {
    findMany.mockResolvedValueOnce(null).mockResolvedValueOnce([
      institution("uni-b", { createdAt: stamped }),
      institution("uni-a", { createdAt: stamped }),
    ]);
    // SUPER_ADMIN → managedInstitutionIds returns null without findMany for scope
    findMany.mockReset();
    count.mockResolvedValue(2);
    const sameCreatedAt = [
      institution("uni-b", { createdAt: stamped, _count: { profiles: 0, documents: 0, admins: 0 } }),
      institution("uni-a", { createdAt: stamped, _count: { profiles: 0, documents: 0, admins: 0 } }),
    ];
    transaction.mockImplementation(async (queries: Promise<unknown>[]) => Promise.all(queries));
    findMany.mockResolvedValue(sameCreatedAt);
    count.mockResolvedValue(2);

    const service = new AdminInstitutionService();
    await service.list({ actorId: "root", actorRole: "SUPER_ADMIN", q: "", page: 1 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: INSTITUTION_LIST_ORDER,
      }),
    );
    expect(INSTITUTION_LIST_ORDER).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("suspend et archive avec AuditLog (plateforme seulement)", async () => {
    const current = institution("uni-1");
    findUnique.mockResolvedValue(current);
    update.mockResolvedValue({ ...current, status: "SUSPENDED" });
    auditCreate.mockResolvedValue({});

    const service = new AdminInstitutionService();
    await service.changeStatus("root", "ADMIN", "uni-1", "SUSPENDED", context);
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "INSTITUTION_SUSPENDED" }),
      }),
    );
  });
});
