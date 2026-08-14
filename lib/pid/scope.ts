import type { PersistentIdentifier, PersistentIdentifierStatus, PidResourceType, Prisma, Role } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";
import { db } from "../db/client";
import { managedDocumentInstitutionIds } from "@/lib/documents/scope";
import { PersistentIdentifierError } from "./errors";

export async function managedPidInstitutionIds(actorId: string, actorRole: Role) {
  return managedDocumentInstitutionIds(actorId, actorRole);
}

export function pidListAccess(scope: string[] | null): "global" | "none" | "scoped" {
  if (scope === null) return "global";
  if (scope.length === 0) return "none";
  return "scoped";
}

/** EXISTS corrélé : ne matérialise pas les resourceId documentaires. */
export function pidInstitutionalExistsSql(scope: string[]): Prisma.Sql {
  return PrismaRuntime.sql`(
    (
      p."resourceType" = 'DOCUMENT'
      AND EXISTS (
        SELECT 1 FROM "Document" d
        WHERE d.id = p."resourceId"
          AND d."universityId" IN (${PrismaRuntime.join(scope)})
      )
    )
    OR
    (
      p."resourceType" = 'PUBLICATION'
      AND EXISTS (
        SELECT 1 FROM "Publication" pub
        INNER JOIN "Document" d ON d.id = pub."documentId"
        WHERE pub.id = p."resourceId"
          AND d."universityId" IN (${PrismaRuntime.join(scope)})
      )
    )
  )`;
}

export function scopedPidWhereSql(
  scope: string[],
  filters: {
    status?: PersistentIdentifierStatus;
    scheme?: PersistentIdentifier["scheme"];
    resourceType?: PidResourceType;
    q?: string;
  },
): Prisma.Sql {
  const parts: Prisma.Sql[] = [pidInstitutionalExistsSql(scope)];
  if (filters.status) {
    parts.push(PrismaRuntime.sql`p.status = ${filters.status}::"PersistentIdentifierStatus"`);
  }
  if (filters.scheme) {
    parts.push(PrismaRuntime.sql`p.scheme = ${filters.scheme}::"PersistentIdentifierScheme"`);
  }
  if (filters.resourceType) {
    parts.push(PrismaRuntime.sql`p."resourceType" = ${filters.resourceType}::"PidResourceType"`);
  }
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    parts.push(PrismaRuntime.sql`(
      p.identifier ILIKE ${pattern}
      OR p.suffix ILIKE ${pattern}
      OR p."resourceId" ILIKE ${pattern}
      OR p."targetUrl" ILIKE ${pattern}
    )`);
  }
  return PrismaRuntime.sql`WHERE ${PrismaRuntime.join(parts, " AND ")}`;
}

export function prismaSqlText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(prismaSqlText).join(" ");
  if (!value || typeof value !== "object") return String(value ?? "");
  const sql = value as { strings?: string[]; values?: unknown[] };
  const head = Array.isArray(sql.strings) ? sql.strings.join(" ") : "";
  const nested = Array.isArray(sql.values) ? sql.values.map(prismaSqlText).join(" ") : "";
  if (head || nested) return `${head} ${nested}`;
  return JSON.stringify(value);
}

export async function assertPidInInstitutionScope(
  pid: Pick<PersistentIdentifier, "resourceType" | "resourceId">,
  scope: string[] | null,
) {
  if (scope === null) return;
  const institutionId = await resolvePidInstitutionId(pid);
  if (!institutionId || !scope.includes(institutionId)) {
    throw new PersistentIdentifierError("Identifiant BICUNI introuvable.", 404);
  }
}

export async function resolvePidInstitutionId(pid: {
  resourceType: PidResourceType | string;
  resourceId: string;
}): Promise<string | null> {
  if (!pid.resourceId) return null;
  if (pid.resourceType === "PUBLICATION") {
    const publication = await db.publication.findUnique({
      where: { id: pid.resourceId },
      select: { document: { select: { universityId: true } } },
    });
    return publication?.document.universityId ?? null;
  }
  const document = await db.document.findUnique({
    where: { id: pid.resourceId },
    select: { universityId: true },
  });
  return document?.universityId ?? null;
}

export function encodePidHistoryCursor(entry: { changedAt: Date; id: string }) {
  return Buffer.from(`${entry.changedAt.toISOString()}|${entry.id}`, "utf8").toString("base64url");
}

export function parsePidHistoryCursor(raw: string | undefined) {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const sep = decoded.lastIndexOf("|");
    if (sep <= 0) return null;
    const changedAt = new Date(decoded.slice(0, sep));
    const id = decoded.slice(sep + 1);
    if (!id || Number.isNaN(changedAt.getTime())) return null;
    return { changedAt, id };
  } catch {
    return null;
  }
}
