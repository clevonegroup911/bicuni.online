import { PidResourceType } from "@prisma/client";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findUnique,
  documentDelete,
  publicationDelete,
  pidDelete,
  pidDeleteMany,
} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  documentDelete: vi.fn(),
  publicationDelete: vi.fn(),
  pidDelete: vi.fn(),
  pidDeleteMany: vi.fn(),
}));

vi.mock("../db/client", () => ({
  db: {
    persistentIdentifier: { findUnique, delete: pidDelete, deleteMany: pidDeleteMany },
    document: { delete: documentDelete },
    publication: { delete: publicationDelete },
  },
}));

vi.mock("../observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { PidBoundResourceError } from "./errors";
import { logger } from "../observability/logger";
import {
  PID_BOUND_RESOURCE_DELETE_FORBIDDEN,
  assertDocumentNotPidBound,
  assertPublicationNotPidBound,
  deleteUnboundDocument,
  deleteUnboundPublication,
  findDocumentPrimaryPid,
  pidResourceIdentityWhere,
} from "./resource-binding";

const documentId = "cmdocument0000000000000001";
const publicationPid = {
  id: "cmpublicationpid00000000001",
  identifier: "bcu/2026.art.01PUB0000000000000000000",
  status: "ACTIVE" as const,
};
const documentPid = {
  id: "cmdocumentpid0000000000001",
  identifier: "bcu/2026.art.01DOC0000000000000000000",
  status: "ACTIVE" as const,
};

function walkSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "e2e") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkSources(full, acc);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.")) acc.push(full);
  }
  return acc;
}

describe("lecture PID par clé composite", () => {
  beforeEach(() => vi.clearAllMocks());

  it("page Document recherche le PID avec DOCUMENT + document.id", async () => {
    findUnique.mockResolvedValue({ identifier: documentPid.identifier, status: documentPid.status });
    const result = await findDocumentPrimaryPid(documentId);
    expect(result).toEqual({ identifier: documentPid.identifier, status: documentPid.status });
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        resourceType_resourceId: {
          resourceType: PidResourceType.DOCUMENT,
          resourceId: documentId,
        },
      },
      select: { identifier: true, status: true },
    });
    expect(findUnique.mock.calls.some(([args]) => args?.where && "resourceId" in args.where && !("resourceType_resourceId" in args.where))).toBe(false);

    const page = readFileSync(path.join(process.cwd(), "app/(site)/documents/[id]/page.tsx"), "utf8");
    expect(page).toMatch(/findDocumentPrimaryPid\(document\.id\)/);
    expect(page).not.toMatch(/persistentIdentifier\.findFirst/);
    expect(page).not.toMatch(/where:\s*\{\s*resourceId:\s*document\.id\s*\}/);
  });

  it("un PID PUBLICATION avec le même resourceId n’est jamais le PID du Document", async () => {
    findUnique.mockImplementation(async (args: { where?: { resourceType_resourceId?: { resourceType: string; resourceId: string } } }) => {
      const key = args.where?.resourceType_resourceId;
      if (key?.resourceType === "PUBLICATION" && key.resourceId === documentId) {
        return { identifier: publicationPid.identifier, status: publicationPid.status };
      }
      if (key?.resourceType === "DOCUMENT" && key.resourceId === documentId) {
        return { identifier: documentPid.identifier, status: documentPid.status };
      }
      return null;
    });

    const result = await findDocumentPrimaryPid(documentId);
    expect(result?.identifier).toBe(documentPid.identifier);
    expect(result?.identifier).not.toBe(publicationPid.identifier);
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: pidResourceIdentityWhere(PidResourceType.DOCUMENT, documentId),
    }));
    expect(findUnique).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { resourceId: documentId },
    }));
  });

  it("ne retourne aucun PID documentaire si seul un PID PUBLICATION partage l’id", async () => {
    findUnique.mockImplementation(async (args: { where?: { resourceType_resourceId?: { resourceType: string } } }) => {
      if (args.where?.resourceType_resourceId?.resourceType === "PUBLICATION") {
        return { identifier: publicationPid.identifier, status: publicationPid.status };
      }
      return null;
    });
    await expect(findDocumentPrimaryPid(documentId)).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { resourceType_resourceId: { resourceType: PidResourceType.DOCUMENT, resourceId: documentId } },
    }));
  });
});

describe("garde applicative DELETE Document / Publication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue(null);
    documentDelete.mockResolvedValue({ id: documentId });
    publicationDelete.mockResolvedValue({ id: documentId });
  });

  it("autorise la suppression d’un Document non référencé par PID", async () => {
    await deleteUnboundDocument(documentId);
    expect(findUnique).toHaveBeenCalledWith({
      where: pidResourceIdentityWhere(PidResourceType.DOCUMENT, documentId),
      select: { id: true },
    });
    expect(documentDelete).toHaveBeenCalledWith({ where: { id: documentId } });
    expect(pidDelete).not.toHaveBeenCalled();
    expect(pidDeleteMany).not.toHaveBeenCalled();
  });

  it("refuse la suppression d’un Document référencé par un PID DOCUMENT", async () => {
    findUnique.mockResolvedValue({ id: documentPid.id });
    await expect(deleteUnboundDocument(documentId)).rejects.toBeInstanceOf(PidBoundResourceError);
    await expect(assertDocumentNotPidBound(documentId)).rejects.toMatchObject({ status: 409 });
    expect(documentDelete).not.toHaveBeenCalled();
    expect(pidDelete).not.toHaveBeenCalled();
    expect(pidDeleteMany).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "pid.bound_resource_delete_blocked",
      expect.any(Error),
      expect.objectContaining({ resourceType: PidResourceType.DOCUMENT }),
    );
    const logged = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(logged).not.toMatch(/bcu\//);
    expect(logged).not.toMatch(/targetUrl/);
  });

  it("un PID PUBLICATION du même resourceId n’empêche pas le DELETE Document applicatif", async () => {
    findUnique.mockImplementation(async (args: { where?: { resourceType_resourceId?: { resourceType: string } } }) => {
      if (args.where?.resourceType_resourceId?.resourceType === "PUBLICATION") return { id: publicationPid.id };
      return null;
    });
    await deleteUnboundDocument(documentId);
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { resourceType_resourceId: { resourceType: PidResourceType.DOCUMENT, resourceId: documentId } },
    }));
    expect(documentDelete).toHaveBeenCalledTimes(1);
  });

  it("refuse la suppression d’une Publication référencée par un PID PUBLICATION", async () => {
    findUnique.mockResolvedValue({ id: publicationPid.id });
    await expect(deleteUnboundPublication(documentId)).rejects.toBeInstanceOf(PidBoundResourceError);
    await expect(assertPublicationNotPidBound(documentId)).rejects.toMatchObject({ status: 409 });
    expect(publicationDelete).not.toHaveBeenCalled();
    expect(pidDelete).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledWith({
      where: pidResourceIdentityWhere(PidResourceType.PUBLICATION, documentId),
      select: { id: true },
    });
  });

  it("autorise la suppression d’une Publication non référencée par PID", async () => {
    await deleteUnboundPublication(documentId);
    expect(publicationDelete).toHaveBeenCalledWith({ where: { id: documentId } });
    expect(pidDelete).not.toHaveBeenCalled();
  });

  it("propage le refus si le trigger PostgreSQL bloque après la garde", async () => {
    documentDelete.mockRejectedValue(new Error(PID_BOUND_RESOURCE_DELETE_FORBIDDEN));
    await expect(deleteUnboundDocument(documentId)).rejects.toBeInstanceOf(PidBoundResourceError);
    expect(pidDelete).not.toHaveBeenCalled();
  });
});

describe("chemins DELETE exposés et protections PID", () => {
  it("le rollback upload passe par deleteUnboundDocument", () => {
    const source = readFileSync(path.join(process.cwd(), "app/api/documents/upload/route.ts"), "utf8");
    expect(source).toMatch(/await deleteUnboundDocument\(document\.id\)/);
    expect(source).not.toMatch(/db\.document\.delete\s*\(/);
  });

  it("aucun chemin applicatif hors helper ne supprime physiquement Document, Publication ou PID", () => {
    const roots = ["app", "lib", "components"].map((dir) => path.join(process.cwd(), dir));
    const files = roots.flatMap((dir) => walkSources(dir));
    const helper = path.join(process.cwd(), "lib/pid/resource-binding.ts");
    const offenders = {
      documentDelete: [] as string[],
      publicationDelete: [] as string[],
      pidDelete: [] as string[],
      pidFindFirst: [] as string[],
    };
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (/\b(?:db|tx)\.document\.delete(?:Many)?\s*\(/.test(source) && file !== helper) {
        offenders.documentDelete.push(file);
      }
      if (/\b(?:db|tx)\.publication\.delete(?:Many)?\s*\(/.test(source) && file !== helper) {
        offenders.publicationDelete.push(file);
      }
      if (/\b(?:db|tx)\.persistentIdentifier\.delete(?:Many)?\s*\(/.test(source)) {
        offenders.pidDelete.push(file);
      }
      if (/\bpersistentIdentifier\.findFirst\s*\(/.test(source)) {
        offenders.pidFindFirst.push(file);
      }
    }
    expect(offenders.documentDelete).toEqual([]);
    expect(offenders.publicationDelete).toEqual([]);
    expect(offenders.pidDelete).toEqual([]);
    expect(offenders.pidFindFirst).toEqual([]);
  });
});
