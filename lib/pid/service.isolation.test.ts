import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findUnique,
  findMany,
  count,
  historyFindMany,
  transaction,
  documentFindUnique,
  documentFindMany,
  publicationFindUnique,
  publicationFindMany,
  universityFindMany,
  queryRaw,
} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  historyFindMany: vi.fn(),
  transaction: vi.fn(),
  documentFindUnique: vi.fn(),
  documentFindMany: vi.fn(),
  publicationFindUnique: vi.fn(),
  publicationFindMany: vi.fn(),
  universityFindMany: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("../db/client", () => ({
  db: {
    persistentIdentifier: { findUnique, findMany, count },
    persistentIdentifierTargetHistory: { findMany: historyFindMany },
    document: { findUnique: documentFindUnique, findMany: documentFindMany },
    publication: { findUnique: publicationFindUnique, findMany: publicationFindMany },
    university: { findMany: universityFindMany },
    $transaction: transaction,
    $queryRaw: queryRaw,
  },
}));

import { PersistentIdentifierService } from "./service";
import { prismaSqlText } from "./scope";

const stamped = new Date("2026-08-13T10:00:00.000Z");
const institutionAdmin = { id: "ia", role: "INSTITUTION_ADMIN" as const };

function pidRow(id: string, resourceId: string, identifier: string) {
  return {
    id,
    identifier,
    scheme: "BICUNI_PID" as const,
    prefix: "bcu",
    suffix: identifier.slice(4),
    resourceType: "DOCUMENT" as const,
    resourceId,
    status: "ACTIVE" as const,
    targetUrl: `https://bicuni.online/documents/${resourceId}`,
    createdAt: stamped,
    updatedAt: stamped,
    metadata: { internalNote: "ne-pas-fuiter" },
    createdBy: { id: "root", name: "Root" },
  };
}

const pidA = pidRow("pida000000000000000000001", "doc-a-000000000000000000001", "bcu/2026.document.01AAAAAAAAAAAA000000000001");
const pidB = pidRow("pidb000000000000000000001", "doc-b-000000000000000000001", "bcu/2026.document.01BBBBBBBBBBBB000000000001");

describe("isolation institutionnelle PID", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (callbackOrQueries: unknown) => {
      if (typeof callbackOrQueries === "function") {
        return (callbackOrQueries as (client: unknown) => unknown)({});
      }
      return Promise.all(callbackOrQueries as Promise<unknown>[]);
    });
    universityFindMany.mockResolvedValue([{ id: "uni-a" }]);
    queryRaw.mockImplementation(async (query: unknown) => {
      const sql = prismaSqlText(query);
      if (sql.includes("COUNT")) return [{ count: 1 }];
      return [pidA];
    });
  });

  it("list d’un admin A contient PID A et pas PID B", async () => {
    const result = await new PersistentIdentifierService().list({
      page: 1,
      actorId: institutionAdmin.id,
      actorRole: institutionAdmin.role,
    });
    expect(result.items.map((item) => item.identifier)).toEqual([pidA.identifier]);
    expect(result.items.map((item) => item.identifier)).not.toContain(pidB.identifier);
    expect(documentFindMany).not.toHaveBeenCalled();
    expect(publicationFindMany).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
    const sql = queryRaw.mock.calls.flat().map((arg) => prismaSqlText(arg)).join("\n");
    expect(sql).toMatch(/EXISTS/);
    expect(sql).toMatch(/universityId/);
    expect(sql).not.toMatch(/resourceId["\s]*IN/i);
  });

  it("GET PID B hors tenant répond 404 sans fuite", async () => {
    findUnique.mockResolvedValue(pidB);
    documentFindUnique.mockResolvedValue({ universityId: "uni-b" });
    await expect(
      new PersistentIdentifierService().getById(pidB.id, institutionAdmin),
    ).rejects.toMatchObject({ status: 404, message: "Identifiant BICUNI introuvable." });
  });

  it("history PID B hors tenant répond 404 sans charger l’historique", async () => {
    findUnique.mockResolvedValue({ id: pidB.id, resourceType: "DOCUMENT", resourceId: pidB.resourceId });
    documentFindUnique.mockResolvedValue({ universityId: "uni-b" });
    await expect(
      new PersistentIdentifierService().history(pidB.id, institutionAdmin),
    ).rejects.toMatchObject({ status: 404 });
    expect(historyFindMany).not.toHaveBeenCalled();
  });

  it("voit PID A dans son institution", async () => {
    findUnique.mockResolvedValue(pidA);
    documentFindUnique.mockResolvedValue({ universityId: "uni-a" });
    const result = await new PersistentIdentifierService().getById(pidA.id, institutionAdmin);
    expect(result.identifier).toBe(pidA.identifier);
  });

  it("un admin sans mandat obtient une liste vide", async () => {
    universityFindMany.mockResolvedValue([]);
    const result = await new PersistentIdentifierService().list({
      page: 1,
      actorId: institutionAdmin.id,
      actorRole: institutionAdmin.role,
    });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(documentFindMany).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN a un accès global sans filtre institutionnel", async () => {
    findMany.mockResolvedValue([pidA, pidB]);
    count.mockResolvedValue(2);
    const result = await new PersistentIdentifierService().list({
      page: 1,
      actorId: "root",
      actorRole: "SUPER_ADMIN",
    });
    expect(result.items).toHaveLength(2);
    expect(universityFindMany).not.toHaveBeenCalled();
    expect(documentFindMany).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("n’accepte pas institutionId client comme autorité", async () => {
    await new PersistentIdentifierService().list({
      page: 1,
      actorId: institutionAdmin.id,
      actorRole: institutionAdmin.role,
      q: "institutionId=uni-b",
    });
    expect(universityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { admins: { some: { id: "ia" } } },
    }));
    expect(documentFindMany).not.toHaveBeenCalled();
  });
});
