import { Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

const {
  findUnique,
  findFirst,
  findMany,
  create,
  update,
  updateMany,
  count,
  historyCreate,
  historyFindMany,
  auditCreate,
  transaction,
  documentFindUnique,
  documentFindMany,
  publicationFindUnique,
  publicationFindMany,
  universityFindMany,
} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  count: vi.fn(),
  historyCreate: vi.fn(),
  historyFindMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  documentFindUnique: vi.fn(),
  documentFindMany: vi.fn(),
  publicationFindUnique: vi.fn(),
  publicationFindMany: vi.fn(),
  universityFindMany: vi.fn(),
}));

vi.mock("../db/client", () => ({
  db: {
    persistentIdentifier: { findUnique, findFirst, findMany, create, update, updateMany, count },
    persistentIdentifierTargetHistory: { create: historyCreate, findMany: historyFindMany },
    auditLog: { create: auditCreate },
    document: { findUnique: documentFindUnique, findMany: documentFindMany },
    publication: { findUnique: publicationFindUnique, findMany: publicationFindMany },
    university: { findMany: universityFindMany },
    $transaction: transaction,
    $queryRaw: vi.fn(),
  },
}));

vi.mock("../observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { PersistentIdentifierError } from "./errors";
import { resetPidMissLogForTests } from "./miss-log";
import { PersistentIdentifierService, type CreatePersistentIdentifierInput } from "./service";
import { logger } from "../observability/logger";

const stamped = new Date("2026-08-13T10:00:00.000Z");
const validCuid = "cm12345678901234567890123";
const resourceId = "cmresource000000000000001";
const root = { id: "root", role: "SUPER_ADMIN" as const };

function pid(overrides: Record<string, unknown> = {}) {
  return {
    id: validCuid,
    scheme: "BICUNI_PID",
    prefix: "bcu",
    suffix: "2026.art.01K2R8M7H7YV5A0000000000",
    identifier: "bcu/2026.art.01K2R8M7H7YV5A0000000000",
    resourceType: "DOCUMENT",
    resourceId,
    targetUrl: `https://bicuni.online/documents/${resourceId}`,
    status: "ACTIVE",
    metadata: {},
    createdById: "root",
    createdAt: stamped,
    updatedAt: stamped,
    ...overrides,
  };
}

function tx() {
  return {
    persistentIdentifier: { findUnique, findFirst, create, update, updateMany },
    persistentIdentifierTargetHistory: { create: historyCreate },
    auditLog: { create: auditCreate },
    document: { findUnique: documentFindUnique },
    publication: { findUnique: publicationFindUnique },
  };
}

describe("PersistentIdentifierService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPidMissLogForTests();
    delete process.env.BICUNI_PID_SCHEME;
    delete process.env.BICUNI_PID_PREFIX;
    transaction.mockImplementation(async (callbackOrQueries: unknown) => {
      if (typeof callbackOrQueries === "function") {
        return (callbackOrQueries as (client: ReturnType<typeof tx>) => unknown)(tx());
      }
      return Promise.all(callbackOrQueries as Promise<unknown>[]);
    });
    findFirst.mockResolvedValue(null);
    findUnique.mockResolvedValue(null);
    documentFindUnique.mockResolvedValue({ id: resourceId, universityId: "uni-a", type: "ARTICLE" });
    publicationFindUnique.mockResolvedValue(null);
    create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => pid(data));
    auditCreate.mockResolvedValue({});
    historyCreate.mockResolvedValue({});
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("refuse de créer si BICUNI_PID_SCHEME=DOI", async () => {
    process.env.BICUNI_PID_SCHEME = "DOI";
    await expect(new PersistentIdentifierService().create({
      resourceType: "DOCUMENT",
      resourceId,
      targetUrl: `https://bicuni.online/documents/${resourceId}`,
      createdBy: "root",
    })).rejects.toBeInstanceOf(PersistentIdentifierError);
    expect(create).not.toHaveBeenCalled();
  });

  it("génère un identifiant et journalise PID_CREATED", async () => {
    const result = await new PersistentIdentifierService().create({
      resourceType: "DOCUMENT",
      resourceId,
      targetUrl: `https://bicuni.online/documents/${resourceId}`,
      createdBy: "root",
    });
    expect(result.identifier).toMatch(/^bcu\/\d{4}\.art\.[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(result.resolverUrl).toBe(`https://bicuni.online/pid/${result.identifier}`);
    expect(create).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "PID_CREATED" }),
    }));
    expect(logger.info).toHaveBeenCalledWith("PID_CREATED", expect.objectContaining({ identifier: result.identifier }));
  });

  it("refuse un document ou une publication inexistants", async () => {
    documentFindUnique.mockResolvedValue(null);
    await expect(new PersistentIdentifierService().create({
      resourceType: "DOCUMENT",
      resourceId,
      suffixType: "ART",
      targetUrl: `https://bicuni.online/documents/${resourceId}`,
      createdBy: "root",
    })).rejects.toMatchObject({ status: 404, message: "Aucun document ne correspond à cette ressource." });
    expect(create).not.toHaveBeenCalled();

    publicationFindUnique.mockResolvedValue(null);
    await expect(new PersistentIdentifierService().create({
      resourceType: "PUBLICATION",
      resourceId,
      suffixType: "ART",
      targetUrl: `https://bicuni.online/documents/${resourceId}`,
      createdBy: "root",
    })).rejects.toMatchObject({ status: 404, message: "Aucune publication ne correspond à cette ressource." });
    expect(create).not.toHaveBeenCalled();
  });

  it("crée un PID PUBLICATION lié à une publication réelle", async () => {
    const publicationId = "cmpublication0000000000001";
    publicationFindUnique.mockResolvedValue({ id: publicationId, document: { type: "ARTICLE" } });
    const result = await new PersistentIdentifierService().create({
      resourceType: "PUBLICATION",
      resourceId: publicationId,
      suffixType: "ART",
      targetUrl: `https://bicuni.online/documents/${resourceId}`,
      createdBy: "root",
    });
    expect(result.identifier).toMatch(/^bcu\/\d{4}\.art\./);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ resourceType: "PUBLICATION", resourceId: publicationId }),
    }));
    expect(documentFindUnique).not.toHaveBeenCalled();
  });

  it("refuse resourceId vide dans le service", async () => {
    await expect(new PersistentIdentifierService().create({
      resourceType: "DOCUMENT",
      resourceId: "   ",
      suffixType: "ART",
      targetUrl: `https://bicuni.online/documents/${resourceId}`,
      createdBy: "root",
    })).rejects.toMatchObject({ status: 400 });
    expect(create).not.toHaveBeenCalled();
    expect(documentFindUnique).not.toHaveBeenCalled();
  });

  it("n’en crée pas un second pour la même ressource composite", async () => {
    findUnique.mockResolvedValue(pid());
    const result = await new PersistentIdentifierService().create({
      resourceType: "DOCUMENT",
      resourceId,
      targetUrl: "https://bicuni.online/library/other",
      createdBy: "root",
    });
    expect(result.identifier).toBe(pid().identifier);
    expect(create).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledWith({
      where: { resourceType_resourceId: { resourceType: "DOCUMENT", resourceId } },
    });
  });

  it("rejette ART, BOOK et THESIS comme resourceType pour un document", async () => {
    const targetUrl = `https://bicuni.online/documents/${resourceId}`;
    for (const resourceType of ["ART", "BOOK", "THESIS"] as const) {
      await expect(new PersistentIdentifierService().create({
        resourceType: resourceType as never,
        resourceId,
        targetUrl,
        createdBy: "root",
      })).rejects.toMatchObject({ status: 400 });
    }
    expect(create).not.toHaveBeenCalled();
  });

  it("ne retourne pas le PID d’un autre resourceType pour le même resourceId", async () => {
    findUnique.mockImplementation(async (args: { where?: { resourceType_resourceId?: { resourceType: string } } }) => {
      if (args.where?.resourceType_resourceId?.resourceType === "DOCUMENT") return pid();
      return null;
    });
    publicationFindUnique.mockResolvedValue(null);
    await expect(new PersistentIdentifierService().create({
      resourceType: "PUBLICATION",
      resourceId,
      targetUrl: `https://bicuni.online/documents/${resourceId}`,
      createdBy: "root",
    })).rejects.toMatchObject({ status: 404 });
    expect(create).not.toHaveBeenCalled();
  });

  it("regénère le suffixe en cas de collision d’identifiant", async () => {
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "taken" })
      .mockResolvedValueOnce(null);
    const result = await new PersistentIdentifierService().create({
      resourceType: "DOCUMENT",
      resourceId,
      suffixType: "THESIS",
      targetUrl: `https://bicuni.online/documents/${resourceId}`,
      createdBy: "root",
    });
    expect(result.identifier).toMatch(/^bcu\/\d{4}\.thesis\./);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("crée un PID DOCUMENT à la publication documentaire", async () => {
    const result = await new PersistentIdentifierService().ensureForPublishedDocument(
      tx() as never,
      { id: resourceId, type: "ARTICLE" },
      "root",
    );
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ resourceType: "DOCUMENT", resourceId }),
    }));
    expect(result.identifier).toMatch(/^bcu\/\d{4}\.art\./);
  });

  it("résout un PID actif vers la destination", async () => {
    findUnique.mockResolvedValue(pid());
    const result = await new PersistentIdentifierService().resolve(pid().identifier);
    expect(result).toMatchObject({ outcome: "redirect", targetUrl: pid().targetUrl });
    expect(logger.info).toHaveBeenCalledWith("PID_RESOLVED", expect.objectContaining({ identifier: pid().identifier }));
  });

  it("signale un identifiant introuvable sans amplifier chaque miss", async () => {
    findUnique.mockResolvedValue(null);
    const service = new PersistentIdentifierService();
    const first = await service.resolve("bcu/2026.art.01K2R8M7H7YV5A0000000000");
    const second = await service.resolve("bcu/2026.art.01K2R8M7H7YV5A0000000000");
    expect(first.outcome).toBe("not_found");
    expect(second.outcome).toBe("not_found");
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("signale un identifiant malformé sans accès DB ni journal applicatif", async () => {
    const result = await new PersistentIdentifierService().resolve("not valid");
    expect(result.outcome).toBe("invalid");
    expect(findUnique).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("rejette un identifiant trop long sans accès DB", async () => {
    const result = await new PersistentIdentifierService().resolve(`bcu/${"a".repeat(200)}`);
    expect(result.outcome).toBe("invalid");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejette un préfixe 10.x sans accès DB", async () => {
    const result = await new PersistentIdentifierService().resolve("10.12345/article.xxxxx");
    expect(result.outcome).toBe("invalid");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("résout encore un PID déprécié", async () => {
    findUnique.mockResolvedValue(pid({ status: "DEPRECATED" }));
    const result = await new PersistentIdentifierService().resolve(pid().identifier);
    expect(result).toMatchObject({ outcome: "redirect", targetUrl: pid().targetUrl });
  });

  it("retourne gone pour un tombstone", async () => {
    findUnique.mockResolvedValue(pid({ status: "TOMBSTONE" }));
    const result = await new PersistentIdentifierService().resolve(pid().identifier);
    expect(result.outcome).toBe("gone");
  });

  it("n’expose pas une metadata privée via l’API publique", async () => {
    findUnique.mockResolvedValue(pid({
      metadata: { title: "Publié", internalNote: "ops", actorEmail: "a@b.c", ipHash: "x" },
    }));
    const result = await new PersistentIdentifierService().getPublicByIdentifier(pid().identifier);
    expect(result.title).toBe("Publié");
    expect(result).not.toHaveProperty("metadata");
    expect(JSON.stringify(result)).not.toMatch(/internalNote|actorEmail|ipHash/);
  });

  it("historise un changement de destination après transition conditionnelle", async () => {
    const current = pid();
    const nextUrl = "https://bicuni.online/library/new";
    findUnique
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce({ ...current, targetUrl: nextUrl });
    updateMany.mockResolvedValue({ count: 1 });
    const result = await new PersistentIdentifierService().updateTarget(current.id, root, nextUrl, "nouvelle URL canonique");
    expect(result.identifier).toBe(current.identifier);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: current.id,
        targetUrl: current.targetUrl,
        status: { in: ["ACTIVE", "DEPRECATED"] },
      },
      data: { targetUrl: nextUrl },
    }));
    expect(historyCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        previousTargetUrl: current.targetUrl,
        newTargetUrl: nextUrl,
      }),
    }));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "PID_TARGET_CHANGED" }),
    }));
    expect(logger.info).toHaveBeenCalledWith("PID_TARGET_CHANGED", expect.objectContaining({ identifier: current.identifier }));
  });

  it("refuse une destination dangereuse", async () => {
    await expect(
      new PersistentIdentifierService().updateTarget(validCuid, root, "https://evil.example/phish", undefined),
    ).rejects.toBeInstanceOf(PersistentIdentifierError);
    expect(updateMany).not.toHaveBeenCalled();
    expect(historyCreate).not.toHaveBeenCalled();
  });

  it("déprécie et tombstone par updateMany conditionnel", async () => {
    findUnique
      .mockResolvedValueOnce(pid())
      .mockResolvedValueOnce(pid({ status: "DEPRECATED" }));
    await new PersistentIdentifierService().deprecate(validCuid, root, "obsolète");
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: validCuid, status: "ACTIVE" },
      data: { status: "DEPRECATED" },
    }));
    expect(logger.info).toHaveBeenCalledWith("PID_DEPRECATED", expect.anything());

    findUnique
      .mockResolvedValueOnce(pid({ status: "DEPRECATED" }))
      .mockResolvedValueOnce(pid({ status: "TOMBSTONE" }));
    await new PersistentIdentifierService().tombstone(validCuid, root, "retiré");
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: validCuid, status: "DEPRECATED" },
      data: { status: "TOMBSTONE" },
    }));
    expect(logger.info).toHaveBeenCalledWith("PID_TOMBSTONED", expect.anything());
  });

  it("refuse de modifier un identifiant tombstoné", async () => {
    findUnique.mockResolvedValue(pid({ status: "TOMBSTONE" }));
    await expect(
      new PersistentIdentifierService().updateTarget(validCuid, root, "https://bicuni.online/library/x", undefined),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      new PersistentIdentifierService().deprecate(validCuid, root, undefined),
    ).rejects.toMatchObject({ status: 409 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("retourne 409 si la transition target concurrente échoue", async () => {
    findUnique.mockResolvedValue(pid());
    updateMany.mockResolvedValue({ count: 0 });
    await expect(
      new PersistentIdentifierService().updateTarget(validCuid, root, "https://bicuni.online/library/new", undefined),
    ).rejects.toMatchObject({ status: 409 });
    expect(historyCreate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("retourne 409 si la transition de statut concurrente échoue", async () => {
    findUnique.mockResolvedValue(pid());
    updateMany.mockResolvedValue({ count: 0 });
    await expect(
      new PersistentIdentifierService().tombstone(validCuid, root, "course"),
    ).rejects.toMatchObject({ status: 409 });
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("n’accepte qu’une des deux mises à jour de destination simultanées", async () => {
    findUnique.mockResolvedValue(pid());
    let accepted = false;
    updateMany.mockImplementation(async () => {
      if (accepted) return { count: 0 };
      accepted = true;
      return { count: 1 };
    });
    const service = new PersistentIdentifierService();
    const results = await Promise.allSettled([
      service.updateTarget(validCuid, root, "https://bicuni.online/library/a", "a"),
      service.updateTarget(validCuid, root, "https://bicuni.online/library/b", "b"),
    ]);
    const fulfilled = results.filter((item) => item.status === "fulfilled");
    const rejected = results.filter((item) => item.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    expect(historyCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it("retente create() après une collision SQL sur l’identifiant", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["identifier"] },
    });
    transaction
      .mockRejectedValueOnce(p2002)
      .mockImplementationOnce(async (callback: (client: ReturnType<typeof tx>) => unknown) => callback(tx()));
    const result = await new PersistentIdentifierService().create({
      resourceType: "DOCUMENT",
      resourceId,
      suffixType: "PAPER",
      targetUrl: `https://bicuni.online/documents/${resourceId}`,
      createdBy: "root",
    });
    expect(result.identifier).toMatch(/^bcu\//);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("refetch P2002 avec la clé composite resourceType + resourceId", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["resourceType", "resourceId"] },
    });
    transaction.mockRejectedValueOnce(p2002);
    findUnique.mockResolvedValue(pid());
    const result = await new PersistentIdentifierService().create({
      resourceType: "DOCUMENT",
      resourceId,
      targetUrl: `https://bicuni.online/documents/${resourceId}`,
      createdBy: "root",
    });
    expect(result.identifier).toBe(pid().identifier);
    expect(findUnique).toHaveBeenCalledWith({
      where: { resourceType_resourceId: { resourceType: "DOCUMENT", resourceId } },
    });
    expect(findUnique.mock.calls.some(([args]) => {
      const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
      return Boolean(where && "resourceId" in where && !("resourceType_resourceId" in where));
    })).toBe(false);
  });

  it("refuse suffixType DOCUMENT ou PUBLICATION à la création", async () => {
    await expect(new PersistentIdentifierService().create({
      resourceType: "DOCUMENT",
      resourceId,
      suffixType: "DOCUMENT" as never,
      targetUrl: `https://bicuni.online/documents/${resourceId}`,
      createdBy: "root",
    })).rejects.toMatchObject({ status: 400 });
    await expect(new PersistentIdentifierService().create({
      resourceType: "DOCUMENT",
      resourceId,
      suffixType: "PUBLICATION" as never,
      targetUrl: `https://bicuni.online/documents/${resourceId}`,
      createdBy: "root",
    })).rejects.toMatchObject({ status: 400 });
    expect(create).not.toHaveBeenCalled();
  });

  it("fait converger deux créations du même DOCUMENT vers le même PID", async () => {
    findUnique.mockResolvedValue(pid());
    const service = new PersistentIdentifierService();
    const input = {
      resourceType: "DOCUMENT" as const,
      resourceId,
      suffixType: "ART" as const,
      targetUrl: `https://bicuni.online/documents/${resourceId}`,
      createdBy: "root",
    };
    const [first, second] = await Promise.all([
      service.create(input),
      service.create(input),
    ]);
    expect(first.identifier).toBe(second.identifier);
    expect(first.identifier).toBe(pid().identifier);
    expect(create).not.toHaveBeenCalled();
  });

  it("exige resourceId au type create() et n’a aucun chemin orphelin", () => {
    expectTypeOf<CreatePersistentIdentifierInput>().toHaveProperty("resourceId");
    expectTypeOf<CreatePersistentIdentifierInput["resourceId"]>().toEqualTypeOf<string>();
    const source = readFileSync(path.join(process.cwd(), "lib/pid/service.ts"), "utf8");
    expect(source).toMatch(/resourceId: string;/);
    expect(source).not.toMatch(/resourceId\?: string \| null/);
    expect(source).not.toMatch(/resourceId: input\.resourceId \?\? null/);
    expect(source).toMatch(/await assertBoundResource\(tx, input\.resourceType, input\.resourceId\)/);
    expect(source).not.toMatch(/if \(input\.resourceId\) \{/);
  });

  it("borne l’historique et n’inclut pas l’historique dans getById", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: `hist-${String(index).padStart(2, "0")}`,
      previousTargetUrl: "https://bicuni.online/a",
      newTargetUrl: "https://bicuni.online/b",
      reason: null,
      changedAt: new Date(stamped.getTime() - index * 1000),
      changedBy: { id: "root", name: "Root" },
    }));
    findUnique.mockResolvedValue({ id: validCuid, resourceType: "DOCUMENT", resourceId });
    historyFindMany.mockResolvedValue(rows);
    const result = await new PersistentIdentifierService().history(validCuid, root, { limit: 20 });
    expect(result.items).toHaveLength(20);
    expect(result.limit).toBe(20);
    expect(result.nextCursor).toBeTruthy();
    expect(historyFindMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 21,
      orderBy: [{ changedAt: "desc" }, { id: "desc" }],
    }));

    findUnique.mockResolvedValue({ ...pid(), createdBy: { id: "root", name: "Root" } });
    const detail = await new PersistentIdentifierService().getById(validCuid, root);
    expect(detail).not.toHaveProperty("history");
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: { createdBy: { select: { id: true, name: true } } },
    }));
  });

  it("clamp la limite d’historique à 50", async () => {
    findUnique.mockResolvedValue({ id: validCuid, resourceType: "DOCUMENT", resourceId });
    historyFindMany.mockResolvedValue([]);
    const result = await new PersistentIdentifierService().history(validCuid, root, { limit: 500 });
    expect(result.limit).toBe(50);
    expect(historyFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51 }));
  });
});
