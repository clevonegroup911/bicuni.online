import {
  Prisma,
  type DocumentType,
  type PersistentIdentifier,
  type PersistentIdentifierStatus,
  type PidResourceType,
} from "@prisma/client";
import { db } from "../db/client";
import { logger } from "../observability/logger";
import { pidScheme, buildResolverUrl } from "./config";
import { PersistentIdentifierError } from "./errors";
import { generatePersistentIdentifier } from "./generator";
import { logPidResolverMiss } from "./miss-log";
import { toCreatedPersistentIdentifier, toPublicPersistentIdentifier } from "./public";
import {
  assertPidInInstitutionScope,
  encodePidHistoryCursor,
  managedPidInstitutionIds,
  parsePidHistoryCursor,
  pidListAccess,
  scopedPidWhereSql,
} from "./scope";
import {
  PID_CANONICAL_DOCUMENT_RESOURCE_TYPE,
  PID_GENERATION_ATTEMPTS,
  PID_HISTORY_DEFAULT_LIMIT,
  PID_HISTORY_MAX_LIMIT,
  PID_LIST_PAGE_SIZE,
  PID_MAX_IDENTIFIER_LENGTH,
  PID_TARGET_MUTABLE_STATUSES,
  pidSuffixTypeFromDocumentType,
  type PidAdminActor,
  type PidSuffixType,
} from "./types";
import {
  assertCanonicalPidResourceType,
  assertPidGenerationConfig,
  documentCanonicalUrl,
  isForbiddenDoiLookalike,
  pidIdentifierSchema,
  validatePidMetadata,
  validatePidTargetUrl,
} from "./validators";

type AuditContext = { ipHash?: string | null; userAgent?: string | null };

export type CreatePersistentIdentifierInput = {
  resourceType: PidResourceType;
  resourceId: string;
  targetUrl: string;
  createdBy?: string | null;
  metadata?: Record<string, unknown> | null;
  suffixType?: PidSuffixType;
};

export type ResolveOutcome =
  | { outcome: "redirect"; identifier: string; targetUrl: string; status: PersistentIdentifierStatus }
  | { outcome: "gone"; identifier: string }
  | { outcome: "not_found"; identifier: string }
  | { outcome: "invalid"; identifier: string };

const PID_LIST_ORDER = [{ createdAt: "desc" as const }, { id: "desc" as const }];
const HISTORY_ORDER = [{ changedAt: "desc" as const }, { id: "desc" as const }];

function isUniqueViolation(error: unknown, fields: string[]) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  const haystack = Array.isArray(target) ? target.map((item) => String(item).toLowerCase()) : [String(target ?? "").toLowerCase()];
  return fields.some((field) => haystack.some((item) => item.includes(field.toLowerCase())));
}

function resourceKey(resourceType: PidResourceType, resourceId: string) {
  return { resourceType_resourceId: { resourceType, resourceId } };
}

export class PersistentIdentifierService {
  async create(input: CreatePersistentIdentifierInput, context: AuditContext = {}) {
    assertCanonicalPidResourceType(input.resourceType);
    const scheme = pidScheme();
    assertPidGenerationConfig("bcu", scheme);
    for (let attempt = 0; attempt < PID_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        return await db.$transaction((tx) => this.createInTransaction(tx, input, context));
      } catch (error) {
        if (isUniqueViolation(error, ["resourcetype", "resourceid"])) {
          const existing = await db.persistentIdentifier.findUnique({
            where: resourceKey(input.resourceType, input.resourceId),
          });
          if (existing && existing.resourceType === input.resourceType && existing.resourceId === input.resourceId) {
            return toCreatedPersistentIdentifier(existing);
          }
        }
        if (isUniqueViolation(error, ["identifier", "prefix", "suffix"]) && attempt < PID_GENERATION_ATTEMPTS - 1) {
          continue;
        }
        throw error;
      }
    }
    throw new PersistentIdentifierError("Impossible de générer un identifiant pérenne unique.", 409);
  }

  async createInTransaction(tx: Prisma.TransactionClient, input: CreatePersistentIdentifierInput, context: AuditContext = {}) {
    assertCanonicalPidResourceType(input.resourceType);
    const scheme = pidScheme();
    assertPidGenerationConfig("bcu", scheme);
    const targetError = validatePidTargetUrl(input.targetUrl);
    if (targetError) throw new PersistentIdentifierError(targetError, 400);
    if (input.metadata) {
      const metadataError = validatePidMetadata(input.metadata);
      if (metadataError) throw new PersistentIdentifierError(metadataError, 400);
    }
    if (!input.resourceId || input.resourceId !== input.resourceId.trim() || /\s/.test(input.resourceId)) {
      throw new PersistentIdentifierError("resourceId est obligatoire.", 400);
    }
    const derivedSuffixType = await assertBoundResource(tx, input.resourceType, input.resourceId);
    const suffixType = input.suffixType ?? derivedSuffixType;
    const existing = await tx.persistentIdentifier.findUnique({
      where: resourceKey(input.resourceType, input.resourceId),
    });
    if (existing) {
      if (existing.resourceType !== input.resourceType || existing.resourceId !== input.resourceId) {
        throw new PersistentIdentifierError("Conflit d’identifiant de ressource.", 409);
      }
      return toCreatedPersistentIdentifier(existing);
    }

    for (let attempt = 0; attempt < PID_GENERATION_ATTEMPTS; attempt += 1) {
      const generated = generatePersistentIdentifier(suffixType, input.resourceId, new Date());
      assertPidGenerationConfig(generated.prefix, scheme);
      if (isForbiddenDoiLookalike(generated.identifier) || generated.prefix !== "bcu") {
        throw new PersistentIdentifierError("La génération locale d’un DOI est interdite.", 400);
      }
      const taken = await tx.persistentIdentifier.findUnique({
        where: { identifier: generated.identifier },
        select: { id: true },
      });
      if (taken) continue;
      const created = await tx.persistentIdentifier.create({
        data: {
          scheme,
          prefix: generated.prefix,
          suffix: generated.suffix,
          identifier: generated.identifier,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          targetUrl: input.targetUrl,
          status: "ACTIVE",
          metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
          createdById: input.createdBy ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: input.createdBy ?? null,
          action: "PID_CREATED",
          entityType: "PersistentIdentifier",
          entityId: created.id,
          newValue: { identifier: created.identifier, resourceType: created.resourceType, resourceId: created.resourceId },
          ipHash: context.ipHash ?? null,
          userAgent: context.userAgent ?? null,
        },
      });
      logger.info("PID_CREATED", {
        identifier: created.identifier,
        resourceType: created.resourceType,
        resourceId: created.resourceId,
        actorId: input.createdBy ?? null,
      });
      return toCreatedPersistentIdentifier(created);
    }
    throw new PersistentIdentifierError("Impossible de générer un identifiant pérenne unique.", 409);
  }

  async ensureForPublishedDocument(
    tx: Prisma.TransactionClient,
    document: { id: string; type: DocumentType },
    createdById: string,
    context: AuditContext = {},
  ) {
    return this.createInTransaction(tx, {
      resourceType: PID_CANONICAL_DOCUMENT_RESOURCE_TYPE,
      resourceId: document.id,
      targetUrl: documentCanonicalUrl(document.id),
      createdBy: createdById,
      suffixType: pidSuffixTypeFromDocumentType(document.type),
    }, context);
  }

  async resolve(identifier: string): Promise<ResolveOutcome> {
    if (
      identifier.length > PID_MAX_IDENTIFIER_LENGTH ||
      isForbiddenDoiLookalike(identifier) ||
      !pidIdentifierSchema.safeParse(identifier).success
    ) {
      return { outcome: "invalid", identifier };
    }
    const parsed = pidIdentifierSchema.parse(identifier);
    const pid = await db.persistentIdentifier.findUnique({ where: { identifier: parsed } });
    if (!pid) {
      logPidResolverMiss("PID_NOT_FOUND", parsed);
      return { outcome: "not_found", identifier: parsed };
    }
    if (pid.status === "TOMBSTONE") {
      logger.info("PID_RESOLVED", { identifier: pid.identifier, status: pid.status });
      return { outcome: "gone", identifier: pid.identifier };
    }
    logger.info("PID_RESOLVED", { identifier: pid.identifier, status: pid.status });
    return { outcome: "redirect", identifier: pid.identifier, targetUrl: pid.targetUrl, status: pid.status };
  }

  async getPublicByIdentifier(identifier: string) {
    if (identifier.length > PID_MAX_IDENTIFIER_LENGTH || isForbiddenDoiLookalike(identifier)) {
      throw new PersistentIdentifierError("Identifiant BICUNI malformé.", 400);
    }
    const parsed = pidIdentifierSchema.safeParse(identifier);
    if (!parsed.success) throw new PersistentIdentifierError("Identifiant BICUNI malformé.", 400);
    const pid = await db.persistentIdentifier.findUnique({ where: { identifier: parsed.data } });
    if (!pid) throw new PersistentIdentifierError("Identifiant BICUNI introuvable.", 404);
    return toPublicPersistentIdentifier(pid);
  }

  async getById(id: string, actor: PidAdminActor) {
    const pid = await db.persistentIdentifier.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!pid) throw new PersistentIdentifierError("Identifiant BICUNI introuvable.", 404);
    const scope = await managedPidInstitutionIds(actor.id, actor.role);
    await assertPidInInstitutionScope(pid, scope);
    return { ...pid, resolverUrl: buildResolverUrl(pid.identifier) };
  }

  async history(id: string, actor: PidAdminActor, query: { cursor?: string; limit?: number } = {}) {
    const pid = await db.persistentIdentifier.findUnique({
      where: { id },
      select: { id: true, resourceType: true, resourceId: true },
    });
    if (!pid) throw new PersistentIdentifierError("Identifiant BICUNI introuvable.", 404);
    const scope = await managedPidInstitutionIds(actor.id, actor.role);
    await assertPidInInstitutionScope(pid, scope);

    const limit = Math.min(Math.max(query.limit ?? PID_HISTORY_DEFAULT_LIMIT, 1), PID_HISTORY_MAX_LIMIT);
    const cursor = query.cursor ? parsePidHistoryCursor(query.cursor) : null;
    if (query.cursor && !cursor) {
      throw new PersistentIdentifierError("Curseur d’historique invalide.", 400);
    }

    const rows = await db.persistentIdentifierTargetHistory.findMany({
      where: {
        persistentIdentifierId: id,
        ...(cursor
          ? {
              OR: [
                { changedAt: { lt: cursor.changedAt } },
                { AND: [{ changedAt: cursor.changedAt }, { id: { lt: cursor.id } }] },
              ],
            }
          : {}),
      },
      orderBy: HISTORY_ORDER,
      take: limit + 1,
      select: {
        id: true,
        previousTargetUrl: true,
        newTargetUrl: true,
        reason: true,
        changedAt: true,
        changedBy: { select: { id: true, name: true } },
      },
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items,
      limit,
      nextCursor: hasMore ? encodePidHistoryCursor(items[items.length - 1]) : null,
    };
  }

  async list(input: {
    q?: string;
    page: number;
    status?: PersistentIdentifierStatus;
    scheme?: PersistentIdentifier["scheme"];
    resourceType?: PidResourceType;
    actorId: string;
    actorRole: PidAdminActor["role"];
  }) {
    const scope = await managedPidInstitutionIds(input.actorId, input.actorRole);
    const access = pidListAccess(scope);
    if (access === "none") {
      return { items: [], total: 0, page: input.page, pageSize: PID_LIST_PAGE_SIZE };
    }
    if (access === "scoped" && scope) {
      return this.listInInstitutionScope(scope, input);
    }
    const filters: Prisma.PersistentIdentifierWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.scheme ? { scheme: input.scheme } : {}),
      ...(input.resourceType ? { resourceType: input.resourceType } : {}),
      ...(input.q
        ? {
            OR: [
              { identifier: { contains: input.q, mode: "insensitive" } },
              { suffix: { contains: input.q, mode: "insensitive" } },
              { resourceId: { contains: input.q, mode: "insensitive" } },
              { targetUrl: { contains: input.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await db.$transaction([
      db.persistentIdentifier.findMany({
        where: filters,
        orderBy: PID_LIST_ORDER,
        skip: (input.page - 1) * PID_LIST_PAGE_SIZE,
        take: PID_LIST_PAGE_SIZE,
        select: {
          id: true,
          identifier: true,
          scheme: true,
          resourceType: true,
          resourceId: true,
          status: true,
          targetUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.persistentIdentifier.count({ where: filters }),
    ]);
    return {
      items: items.map((item) => ({ ...item, resolverUrl: buildResolverUrl(item.identifier) })),
      total,
      page: input.page,
      pageSize: PID_LIST_PAGE_SIZE,
    };
  }

  private async listInInstitutionScope(
    scope: string[],
    input: {
      q?: string;
      page: number;
      status?: PersistentIdentifierStatus;
      scheme?: PersistentIdentifier["scheme"];
      resourceType?: PidResourceType;
    },
  ) {
    const whereSql = scopedPidWhereSql(scope, {
      status: input.status,
      scheme: input.scheme,
      resourceType: input.resourceType,
      q: input.q,
    });
    const offset = (input.page - 1) * PID_LIST_PAGE_SIZE;
    const [items, countRows] = await Promise.all([
      db.$queryRaw<Array<{
        id: string;
        identifier: string;
        scheme: PersistentIdentifier["scheme"];
        resourceType: PidResourceType;
        resourceId: string;
        status: PersistentIdentifierStatus;
        targetUrl: string;
        createdAt: Date;
        updatedAt: Date;
      }>>`
        SELECT
          p.id,
          p.identifier,
          p.scheme,
          p."resourceType" AS "resourceType",
          p."resourceId" AS "resourceId",
          p.status,
          p."targetUrl" AS "targetUrl",
          p."createdAt" AS "createdAt",
          p."updatedAt" AS "updatedAt"
        FROM "PersistentIdentifier" p
        ${whereSql}
        ORDER BY p."createdAt" DESC, p.id DESC
        LIMIT ${PID_LIST_PAGE_SIZE} OFFSET ${offset}
      `,
      db.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM "PersistentIdentifier" p
        ${whereSql}
      `,
    ]);
    return {
      items: items.map((item) => ({ ...item, resolverUrl: buildResolverUrl(item.identifier) })),
      total: countRows[0]?.count ?? 0,
      page: input.page,
      pageSize: PID_LIST_PAGE_SIZE,
    };
  }

  async updateTarget(id: string, actor: PidAdminActor, targetUrl: string, reason: string | undefined, context: AuditContext = {}) {
    const targetError = validatePidTargetUrl(targetUrl);
    if (targetError) throw new PersistentIdentifierError(targetError, 400);
    return db.$transaction(async (tx) => {
      const current = await tx.persistentIdentifier.findUnique({ where: { id } });
      if (!current) throw new PersistentIdentifierError("Identifiant BICUNI introuvable.", 404);
      await this.assertWritable(current, actor);
      if (current.status === "TOMBSTONE") {
        throw new PersistentIdentifierError("Un identifiant tombstoné ne peut plus changer de destination.", 409);
      }
      if (current.targetUrl === targetUrl) {
        return { ...current, resolverUrl: buildResolverUrl(current.identifier) };
      }
      const transition = await tx.persistentIdentifier.updateMany({
        where: {
          id,
          targetUrl: current.targetUrl,
          status: { in: [...PID_TARGET_MUTABLE_STATUSES] },
        },
        data: { targetUrl },
      });
      if (transition.count !== 1) {
        throw new PersistentIdentifierError("Cette transition n’est plus possible.", 409);
      }
      await tx.persistentIdentifierTargetHistory.create({
        data: {
          persistentIdentifierId: id,
          previousTargetUrl: current.targetUrl,
          newTargetUrl: targetUrl,
          changedById: actor.id,
          reason: reason ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "PID_TARGET_CHANGED",
          entityType: "PersistentIdentifier",
          entityId: id,
          oldValue: { targetHost: hostOf(current.targetUrl) },
          newValue: { targetHost: hostOf(targetUrl) },
          payload: reason ? { reason } : undefined,
          ipHash: context.ipHash ?? null,
          userAgent: context.userAgent ?? null,
        },
      });
      logger.info("PID_TARGET_CHANGED", { identifier: current.identifier, actorId: actor.id });
      const updated = await tx.persistentIdentifier.findUnique({ where: { id } });
      if (!updated) throw new PersistentIdentifierError("Identifiant BICUNI introuvable.", 404);
      return { ...updated, resolverUrl: buildResolverUrl(updated.identifier) };
    });
  }

  async deprecate(id: string, actor: PidAdminActor, reason: string | undefined, context: AuditContext = {}) {
    return this.changeStatus(id, actor, "DEPRECATED", "PID_DEPRECATED", reason, context);
  }

  async tombstone(id: string, actor: PidAdminActor, reason: string | undefined, context: AuditContext = {}) {
    return this.changeStatus(id, actor, "TOMBSTONE", "PID_TOMBSTONED", reason, context);
  }

  private async assertWritable(pid: Pick<PersistentIdentifier, "resourceType" | "resourceId">, actor: PidAdminActor) {
    const scope = await managedPidInstitutionIds(actor.id, actor.role);
    await assertPidInInstitutionScope(pid, scope);
  }

  private async changeStatus(
    id: string,
    actor: PidAdminActor,
    status: Exclude<PersistentIdentifierStatus, "ACTIVE">,
    action: "PID_DEPRECATED" | "PID_TOMBSTONED",
    reason: string | undefined,
    context: AuditContext,
  ) {
    return db.$transaction(async (tx) => {
      const current = await tx.persistentIdentifier.findUnique({ where: { id } });
      if (!current) throw new PersistentIdentifierError("Identifiant BICUNI introuvable.", 404);
      await this.assertWritable(current, actor);
      if (current.status === "TOMBSTONE") {
        throw new PersistentIdentifierError("Un identifiant tombstoné ne peut plus changer de statut.", 409);
      }
      if (current.status === status) {
        return { ...current, resolverUrl: buildResolverUrl(current.identifier) };
      }
      const transition = await tx.persistentIdentifier.updateMany({
        where: { id, status: current.status },
        data: { status },
      });
      if (transition.count !== 1) {
        throw new PersistentIdentifierError("Cette transition n’est plus possible.", 409);
      }
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action,
          entityType: "PersistentIdentifier",
          entityId: id,
          oldValue: { status: current.status },
          newValue: { status },
          payload: reason ? { reason } : undefined,
          ipHash: context.ipHash ?? null,
          userAgent: context.userAgent ?? null,
        },
      });
      logger.info(action, { identifier: current.identifier, actorId: actor.id });
      const updated = await tx.persistentIdentifier.findUnique({ where: { id } });
      if (!updated) throw new PersistentIdentifierError("Identifiant BICUNI introuvable.", 404);
      return { ...updated, resolverUrl: buildResolverUrl(updated.identifier) };
    });
  }
}

async function assertBoundResource(
  tx: Prisma.TransactionClient,
  resourceType: PidResourceType,
  resourceId: string,
) {
  if (resourceType === "PUBLICATION") {
    const publication = await tx.publication.findUnique({
      where: { id: resourceId },
      select: { id: true, document: { select: { type: true } } },
    });
    if (!publication) {
      throw new PersistentIdentifierError("Aucune publication ne correspond à cette ressource.", 404);
    }
    return pidSuffixTypeFromDocumentType(publication.document.type);
  }
  const document = await tx.document.findUnique({
    where: { id: resourceId },
    select: { id: true, type: true },
  });
  if (!document) {
    throw new PersistentIdentifierError("Aucun document ne correspond à cette ressource.", 404);
  }
  return pidSuffixTypeFromDocumentType(document.type);
}

function hostOf(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}
