import { DocumentType, InstitutionStatus, InstitutionType, Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { reviewSchema } from "../validators/document";

export const adminUserQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).default(1),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export const createAdminSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
  role: z.enum(["ADMIN", "MODERATOR", "INSTITUTION_ADMIN", "SUPER_ADMIN"]),
});

export const updateAdminUserSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("role"), role: z.nativeEnum(Role) }),
  z.object({ action: z.literal("status"), status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]) }),
]);

const optionalUrl = z
  .union([z.string().trim().url().max(500), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));

const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value));

export const institutionSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug invalide (minuscules, chiffres et tirets).");

/** Borne supérieure raisonnable pour éviter skip/take pathologiques côté Prisma. */
export const ADMIN_INSTITUTION_PAGE_MAX = 10_000;

export const adminInstitutionQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().finite().min(1).max(ADMIN_INSTITUTION_PAGE_MAX).default(1),
  status: z.nativeEnum(InstitutionStatus).optional(),
  type: z.nativeEnum(InstitutionType).optional(),
  country: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type AdminInstitutionQuery = z.infer<typeof adminInstitutionQuerySchema>;

export function parseAdminInstitutionQuery(input: unknown) {
  return adminInstitutionQuerySchema.safeParse(input);
}

/** Même schéma API/page : succès = données validées ; échec = défauts sûrs explicites. */
export function resolveAdminInstitutionQuery(input: unknown): {
  ok: boolean;
  data: AdminInstitutionQuery;
} {
  const parsed = parseAdminInstitutionQuery(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, data: adminInstitutionQuerySchema.parse({}) };
}

export const institutionWriteSchema = z.object({
  name: z.string().trim().min(2).max(200),
  acronym: optionalText(40),
  slug: institutionSlugSchema,
  type: z.nativeEnum(InstitutionType),
  country: z.string().trim().min(2).max(80),
  province: optionalText(120),
  city: optionalText(120),
  address: optionalText(300),
  website: optionalUrl,
  domain: optionalText(120),
  logoUrl: optionalUrl,
  status: z.nativeEnum(InstitutionStatus).optional(),
});

export const updateInstitutionSchema = z.discriminatedUnion("action", [
  institutionWriteSchema.extend({ action: z.literal("update") }),
  z.object({
    action: z.literal("status"),
    status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"]),
  }),
]);

export const ADMIN_DOCUMENT_PAGE_MAX = 10_000;
export const ADMIN_DOCUMENT_PAGE_SIZE = 25;
export const ADMIN_DOCUMENT_PAGE_SIZE_MAX = 50;

export function isStrictCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
  );
}

const optionalStrictIsoDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .superRefine((value, ctx) => {
    if (value === undefined) return;
    if (!isStrictCalendarDate(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Date invalide." });
    }
  });

export const adminDocumentStatusFilter = z.enum([
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
  "ARCHIVED",
]);

export const adminDocumentQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().finite().min(1).max(ADMIN_DOCUMENT_PAGE_MAX).default(1),
  limit: z.coerce.number().int().finite().min(1).max(ADMIN_DOCUMENT_PAGE_SIZE_MAX).default(ADMIN_DOCUMENT_PAGE_SIZE),
  status: adminDocumentStatusFilter.optional(),
  type: z.nativeEnum(DocumentType).optional(),
  institutionId: z.string().cuid().optional(),
  from: optionalStrictIsoDate,
  to: optionalStrictIsoDate,
}).superRefine((data, ctx) => {
  if (data.from && data.to && data.from > data.to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "La date de début doit précéder la date de fin.",
      path: ["from"],
    });
  }
});

export type AdminDocumentQuery = z.infer<typeof adminDocumentQuerySchema>;

export function parseAdminDocumentQuery(input: unknown) {
  return adminDocumentQuerySchema.safeParse(input);
}

export function resolveAdminDocumentQuery(input: unknown): {
  ok: boolean;
  data: AdminDocumentQuery;
} {
  const parsed = parseAdminDocumentQuery(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, data: adminDocumentQuerySchema.parse({}) };
}

export const updateAdminDocumentSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("review"), review: reviewSchema }),
  z.object({ action: z.literal("archive") }),
]);

export const adminDocumentIdSchema = z.string().cuid();
