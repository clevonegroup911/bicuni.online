import type { DocumentType, PidResourceType, Role } from "@prisma/client";

export type PidAdminActor = { id: string; role: Role };

export const PID_IDENTITY_RESOURCE_TYPES = ["DOCUMENT", "PUBLICATION"] as const satisfies readonly PidResourceType[];

export const PID_SUFFIX_TYPES = [
  "ART",
  "BOOK",
  "THESIS",
  "PAPER",
  "DATASET",
  "REPORT",
  "COURSE",
  "MEDIA",
] as const;

export type PidSuffixType = (typeof PID_SUFFIX_TYPES)[number];

export const PID_RESOURCE_TYPES = PID_IDENTITY_RESOURCE_TYPES;

export const PID_DOCUMENT_LIKE_RESOURCE_TYPES = PID_SUFFIX_TYPES;

export const PID_SUFFIX_TYPE_CODES: Record<PidSuffixType, string> = {
  ART: "art",
  BOOK: "book",
  THESIS: "thesis",
  PAPER: "paper",
  DATASET: "dataset",
  REPORT: "report",
  COURSE: "course",
  MEDIA: "media",
};

export const PID_RESOURCE_TYPE_PUBLIC: Record<PidResourceType, string> = {
  DOCUMENT: "document",
  PUBLICATION: "publication",
};

const IDENTITY_ALIASES: Record<string, PidResourceType> = {
  document: "DOCUMENT",
  publication: "PUBLICATION",
};

const SUFFIX_ALIASES: Record<string, PidSuffixType> = {
  art: "ART",
  article: "ART",
  book: "BOOK",
  thesis: "THESIS",
  these: "THESIS",
  mémoire: "THESIS",
  memoire: "THESIS",
  paper: "PAPER",
  tfc: "PAPER",
  dataset: "DATASET",
  report: "REPORT",
  rapport: "REPORT",
  course: "COURSE",
  media: "MEDIA",
};

export function parsePidIdentityResourceType(value: string): PidResourceType | null {
  const normalized = value.trim();
  if ((PID_IDENTITY_RESOURCE_TYPES as readonly string[]).includes(normalized)) {
    return normalized as PidResourceType;
  }
  return IDENTITY_ALIASES[normalized.toLowerCase()] ?? null;
}

export function isPidSuffixType(value: string): value is PidSuffixType {
  return (PID_SUFFIX_TYPES as readonly string[]).includes(value);
}

export function parsePidSuffixType(value: string): PidSuffixType | null {
  const normalized = value.trim();
  if (isPidSuffixType(normalized)) return normalized;
  return SUFFIX_ALIASES[normalized.toLowerCase()] ?? null;
}

export function parsePidResourceType(value: string): PidResourceType | null {
  return parsePidIdentityResourceType(value);
}

export function isDocumentLikeResourceType(value: string) {
  return parsePidSuffixType(value) !== null;
}

export function pidSuffixTypeFromDocumentType(type: DocumentType): PidSuffixType {
  switch (type) {
    case "ARTICLE":
      return "ART";
    case "THESE":
    case "MEMOIRE":
      return "THESIS";
    case "TFC":
      return "PAPER";
    case "RAPPORT":
      return "REPORT";
  }
}

export const PID_CANONICAL_DOCUMENT_RESOURCE_TYPE = "DOCUMENT" as const satisfies PidResourceType;
export const PID_INTERNAL_PREFIX = "bcu";
export const PID_MAX_PREFIX_LENGTH = 3;
export const PID_MAX_SUFFIX_LENGTH = 80;
export const PID_MAX_IDENTIFIER_LENGTH = PID_MAX_PREFIX_LENGTH + 1 + PID_MAX_SUFFIX_LENGTH;
export const PID_MAX_TARGET_URL_LENGTH = 2_000;
export const PID_GENERATION_ATTEMPTS = 8;
export const PID_HISTORY_DEFAULT_LIMIT = 20;
export const PID_HISTORY_MAX_LIMIT = 50;
export const PID_LIST_PAGE_SIZE = 25;
export const PID_TARGET_MUTABLE_STATUSES = ["ACTIVE", "DEPRECATED"] as const;
