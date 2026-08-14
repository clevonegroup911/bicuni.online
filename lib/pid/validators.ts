import { z } from "zod";
import { PersistentIdentifierStatus, PersistentIdentifierScheme } from "@prisma/client";
import { pidAllowedHosts, pidRequireHttps, publicAppUrl } from "./config";
import { PersistentIdentifierError } from "./errors";
import {
  PID_HISTORY_DEFAULT_LIMIT,
  PID_HISTORY_MAX_LIMIT,
  PID_INTERNAL_PREFIX,
  PID_MAX_IDENTIFIER_LENGTH,
  PID_MAX_PREFIX_LENGTH,
  PID_MAX_SUFFIX_LENGTH,
  PID_MAX_TARGET_URL_LENGTH,
  PID_RESOURCE_TYPES,
  isDocumentLikeResourceType,
  parsePidIdentityResourceType,
  parsePidSuffixType,
} from "./types";

const SUFFIX_CHAR_PATTERN = new RegExp(`^[A-Za-z0-9][A-Za-z0-9._\\-/]{0,${PID_MAX_SUFFIX_LENGTH - 1}}$`);
const DANGEROUS_PROTOCOLS = /^(javascript|data|file|vbscript|blob):/i;
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", "[::]"]);
const MAX_METADATA_KEYS = 16;
const MAX_METADATA_DEPTH = 2;
const MAX_METADATA_BYTES = 2_048;

export const pidPrefixSchema = z
  .string()
  .trim()
  .min(PID_MAX_PREFIX_LENGTH)
  .max(PID_MAX_PREFIX_LENGTH)
  .refine((value) => value === PID_INTERNAL_PREFIX && !isForbiddenDoiLookalike(value), "Préfixe d’identifiant invalide.");

export function isForbiddenDoiLookalike(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "doi" ||
    normalized === "10.bcu" ||
    normalized.startsWith("10.") ||
    normalized.startsWith("10.87878/bicuni") ||
    normalized.includes("10.87878/bicuni")
  );
}

export function assertCanonicalPidResourceType(resourceType: string) {
  if (isDocumentLikeResourceType(resourceType) || !parsePidIdentityResourceType(resourceType)) {
    throw new PersistentIdentifierError(
      "resourceType doit être DOCUMENT ou PUBLICATION. ART, BOOK et THESIS sont réservés à suffixType.",
      400,
    );
  }
}

export function assertPidGenerationConfig(prefix: string, scheme: string) {
  if (scheme === "DOI" || scheme !== "BICUNI_PID") {
    throw new PersistentIdentifierError("La génération locale d’un DOI est interdite. Seul BICUNI_PID est accepté.", 400);
  }
  if (isForbiddenDoiLookalike(prefix) || prefix.startsWith("10.") || prefix.toLowerCase() === "10.bcu") {
    throw new PersistentIdentifierError("Un préfixe de type DOI (10.x, 10.bcu, 10.87878/bicuni) est interdit.", 400);
  }
  if (prefix !== PID_INTERNAL_PREFIX) {
    throw new PersistentIdentifierError("Seul le préfixe interne bcu est autorisé.", 400);
  }
}

export const pidSuffixSchema = z
  .string()
  .trim()
  .min(3)
  .max(PID_MAX_SUFFIX_LENGTH)
  .refine((value) => !/\s/.test(value), "Le suffixe ne peut pas contenir d’espaces.")
  .refine((value) => !value.includes(".."), "Le suffixe contient une séquence interdite.")
  .refine((value) => !value.includes("//") && !value.startsWith("/") && !value.endsWith("/"), "Le suffixe contient un chemin invalide.")
  .refine((value) => SUFFIX_CHAR_PATTERN.test(value), "Le suffixe contient des caractères interdits.")
  .refine((value) => !hasTraversal(value), "Le suffixe contient une traversée de chemin.");

export const pidIdentifierSchema = z
  .string()
  .trim()
  .min(7)
  .max(PID_MAX_IDENTIFIER_LENGTH)
  .refine((value) => !/\s/.test(value), "L’identifiant ne peut pas contenir d’espaces.")
  .refine((value) => value.includes("/"), "L’identifiant doit contenir un préfixe et un suffixe.")
  .superRefine((value, ctx) => {
    const parsed = splitIdentifier(value);
    if (!parsed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Identifiant BICUNI malformé." });
      return;
    }
    const prefix = pidPrefixSchema.safeParse(parsed.prefix);
    const suffix = pidSuffixSchema.safeParse(parsed.suffix);
    if (!prefix.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Préfixe d’identifiant invalide." });
    }
    if (!suffix.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Suffixe d’identifiant invalide." });
    }
  });

export const pidResourceTypeSchema = z.string().trim().min(2).max(40).transform((value, ctx) => {
  if (isDocumentLikeResourceType(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "ART, BOOK et THESIS ne sont pas des resourceType. Utilisez DOCUMENT et suffixType.",
    });
    return z.NEVER;
  }
  const parsed = parsePidIdentityResourceType(value);
  if (!parsed) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "resourceType doit être DOCUMENT ou PUBLICATION." });
    return z.NEVER;
  }
  return parsed;
});

export const pidSuffixTypeSchema = z.string().trim().min(2).max(40).transform((value, ctx) => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "DOCUMENT" || normalized === "PUBLICATION") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "DOCUMENT et PUBLICATION sont des resourceType, pas des suffixType.",
    });
    return z.NEVER;
  }
  const parsed = parsePidSuffixType(value);
  if (!parsed) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "suffixType d’identifiant invalide." });
    return z.NEVER;
  }
  return parsed;
});

export const pidResourceIdSchema = z
  .string({
    required_error: "resourceId est obligatoire.",
    invalid_type_error: "resourceId est obligatoire.",
  })
  .min(1, "resourceId est obligatoire.")
  .cuid("resourceId invalide.")
  .refine((value) => value === value.trim() && !/\s/.test(value), "resourceId ne peut pas contenir d’espaces.");

export const pidTargetUrlSchema = z
  .string()
  .trim()
  .min(8)
  .max(PID_MAX_TARGET_URL_LENGTH)
  .superRefine((value, ctx) => {
    const error = validatePidTargetUrl(value);
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
  });

export const pidMetadataSchema = z
  .record(z.unknown())
  .optional()
  .nullable()
  .superRefine((value, ctx) => {
    if (value == null) return;
    const error = validatePidMetadata(value);
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
  });

export const createPersistentIdentifierSchema = z.object({
  resourceType: pidResourceTypeSchema,
  suffixType: pidSuffixTypeSchema.optional(),
  resourceId: pidResourceIdSchema,
  targetUrl: pidTargetUrlSchema,
  metadata: pidMetadataSchema,
}).strict();

export const adminPidQuerySchema = z.object({
  q: z.string().trim().max(220).default(""),
  page: z.coerce.number().int().finite().min(1).max(10_000).default(1),
  status: z.nativeEnum(PersistentIdentifierStatus).optional(),
  scheme: z.nativeEnum(PersistentIdentifierScheme).optional(),
  resourceType: pidResourceTypeSchema.optional(),
});

export const updatePidTargetSchema = z.object({
  action: z.literal("updateTarget"),
  targetUrl: pidTargetUrlSchema,
  reason: z.string().trim().max(500).optional(),
}).strict();

export const deprecatePidSchema = z.object({
  action: z.literal("deprecate"),
  reason: z.string().trim().max(500).optional(),
}).strict();

export const tombstonePidSchema = z.object({
  action: z.literal("tombstone"),
  reason: z.string().trim().max(500).optional(),
}).strict();

export const updatePersistentIdentifierSchema = z.discriminatedUnion("action", [
  updatePidTargetSchema,
  deprecatePidSchema,
  tombstonePidSchema,
]);

export const adminPidIdSchema = z.string().cuid();

export const adminPidHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().finite().min(1).max(PID_HISTORY_MAX_LIMIT).default(PID_HISTORY_DEFAULT_LIMIT),
  cursor: z.string().trim().min(8).max(160).optional(),
});

export function splitIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash === trimmed.length - 1) return null;
  return {
    prefix: trimmed.slice(0, slash),
    suffix: trimmed.slice(slash + 1),
  };
}

export function parseResolverParts(prefix: string, suffixSegments: string[]) {
  const decodedPrefix = safeDecode(prefix);
  const decodedSuffix = suffixSegments.map(safeDecode).join("/");
  if (!decodedPrefix || !decodedSuffix) {
    throw new PersistentIdentifierError("Identifiant BICUNI malformé.", 400);
  }
  if (
    decodedPrefix.length > PID_MAX_PREFIX_LENGTH ||
    decodedSuffix.length > PID_MAX_SUFFIX_LENGTH ||
    decodedPrefix.length + 1 + decodedSuffix.length > PID_MAX_IDENTIFIER_LENGTH ||
    isForbiddenDoiLookalike(decodedPrefix) ||
    isForbiddenDoiLookalike(`${decodedPrefix}/${decodedSuffix}`)
  ) {
    throw new PersistentIdentifierError("Identifiant BICUNI malformé.", 400);
  }
  const parsed = pidIdentifierSchema.safeParse(`${decodedPrefix}/${decodedSuffix}`);
  if (!parsed.success) {
    throw new PersistentIdentifierError("Identifiant BICUNI malformé.", 400);
  }
  const parts = splitIdentifier(parsed.data);
  if (!parts) throw new PersistentIdentifierError("Identifiant BICUNI malformé.", 400);
  return parts;
}

export function validatePidMetadata(value: Record<string, unknown>): string | null {
  const keys = Object.keys(value);
  if (keys.length > MAX_METADATA_KEYS) return "Métadonnées trop nombreuses.";
  if (jsonDepth(value) > MAX_METADATA_DEPTH) return "Métadonnées trop profondes.";
  try {
    if (JSON.stringify(value).length > MAX_METADATA_BYTES) return "Métadonnées trop volumineuses.";
  } catch {
    return "Métadonnées invalides.";
  }
  return null;
}

export function documentCanonicalUrl(documentId: string) {
  return `${publicAppUrl()}/documents/${documentId}`;
}

export function validatePidTargetUrl(value: string): string | null {
  if (DANGEROUS_PROTOCOLS.test(value.trim())) {
    return "Protocole de destination interdit.";
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "URL de destination invalide.";
  }
  if (url.username || url.password) {
    return "Les identifiants dans l’URL de destination sont interdits.";
  }
  const protocol = url.protocol.toLowerCase();
  const httpsOnly = pidRequireHttps();
  if (protocol !== "https:") {
    if (httpsOnly || protocol !== "http:") {
      return "Seules les destinations HTTPS sont acceptées.";
    }
    if (!isAppHost(url.hostname)) {
      return "Le HTTP n’est autorisé que pour l’hôte de l’application en développement.";
    }
  }
  const hostname = url.hostname.replace(/\.$/, "").toLowerCase();
  if (!hostname) return "Hôte de destination invalide.";
  if (isBlockedHost(hostname)) return "Destination locale ou privée interdite.";
  if (hasTraversal(url.pathname) || hasTraversal(safeDecode(url.pathname))) {
    return "L’URL de destination contient une traversée de chemin.";
  }
  if (!isAllowedHost(hostname)) {
    return "Hôte de destination non autorisé.";
  }
  return null;
}

function isBlockedHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (LOOPBACK.has(host) || LOOPBACK.has(hostname)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^(0:0:0:0:0:0:0:1|::1)$/i.test(host)) return true;
  return false;
}

function isAllowedHost(hostname: string) {
  return pidAllowedHosts().some((pattern) => hostMatches(hostname, pattern));
}

function isAppHost(hostname: string) {
  try {
    return hostname.replace(/\.$/, "").toLowerCase() === new URL(publicAppUrl()).hostname.toLowerCase();
  } catch {
    return false;
  }
}

function hostMatches(hostname: string, pattern: string) {
  const host = hostname.toLowerCase();
  const allowed = pattern.toLowerCase();
  if (allowed.startsWith("*.")) {
    const base = allowed.slice(2);
    return host === base || host.endsWith(`.${base}`);
  }
  return host === allowed;
}

function hasTraversal(value: string) {
  return value.split(/[/\\]/).includes("..");
}

function jsonDepth(value: unknown, depth = 1): number {
  if (!value || typeof value !== "object") return depth;
  const children = Object.values(value as Record<string, unknown>);
  if (children.length === 0) return depth;
  return Math.max(depth, ...children.map((child) => jsonDepth(child, depth + 1)));
}

function safeDecode(value: string) {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) return next;
      current = next;
    } catch {
      return current;
    }
  }
  return current;
}

export { PID_RESOURCE_TYPES };
