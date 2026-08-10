import { InstitutionStatus, InstitutionType, Role, UserStatus } from "@prisma/client";
import { z } from "zod";

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
