import type { PersistentIdentifier, PersistentIdentifierStatus } from "@prisma/client";
import { buildResolverUrl } from "./config";
import { PID_RESOURCE_TYPE_PUBLIC } from "./types";

const PUBLIC_TITLE_MAX = 200;

export function toPublicPersistentIdentifier(pid: Pick<
  PersistentIdentifier,
  "identifier" | "scheme" | "resourceType" | "status" | "targetUrl" | "createdAt" | "updatedAt" | "metadata"
>) {
  const title = publicPidTitle(pid.metadata);
  return {
    identifier: pid.identifier,
    scheme: pid.scheme,
    status: pid.status,
    resourceType: PID_RESOURCE_TYPE_PUBLIC[pid.resourceType],
    ...(exposesTarget(pid.status) ? { targetUrl: pid.targetUrl } : {}),
    createdAt: pid.createdAt.toISOString(),
    updatedAt: pid.updatedAt.toISOString(),
    ...(title ? { title } : {}),
  };
}

export function toCreatedPersistentIdentifier(pid: Pick<PersistentIdentifier, "identifier">) {
  return {
    identifier: pid.identifier,
    resolverUrl: buildResolverUrl(pid.identifier),
  };
}

export function publicPidTitle(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const title = (metadata as Record<string, unknown>).title;
  if (typeof title !== "string") return undefined;
  const trimmed = title.trim().slice(0, PUBLIC_TITLE_MAX);
  return trimmed || undefined;
}

function exposesTarget(status: PersistentIdentifierStatus) {
  return status === "ACTIVE" || status === "DEPRECATED";
}
