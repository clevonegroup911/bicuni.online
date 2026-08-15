import { z } from "zod";

export const PROFILE_WRITE_PATH = "/api/profile";
export const PROFILE_WRITE_METHOD = "PATCH" as const;

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null);

const orcidPattern = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export const profileWriteSchema = z.object({
  name: optionalText(120),
  title: optionalText(160),
  bio: optionalText(2000),
  country: optionalText(80),
  orcid: z
    .string()
    .trim()
    .max(19)
    .transform((value) => value || null)
    .refine((value) => value === null || orcidPattern.test(value), "ORCID invalide (ex. 0000-0002-1825-0097)."),
  website: z
    .string()
    .trim()
    .max(240)
    .transform((value) => value || null)
    .refine((value) => {
      if (value === null) return true;
      try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    }, "Le site doit être une URL http(s) complète."),
  image: z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null)
    .refine((value) => value === null || Boolean(safeImageUrl(value)), "L’avatar doit être une URL http(s) ou un chemin relatif."),
  researchFields: z.array(z.string().trim().min(2).max(80)).max(12).default([]),
  universityId: z.string().cuid().nullable(),
  departmentId: z.string().cuid().nullable(),
}).superRefine((value, context) => {
  if (value.departmentId && !value.universityId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Un département nécessite une université.",
      path: ["departmentId"],
    });
  }
});

export type ProfileWriteInput = z.input<typeof profileWriteSchema>;
export type ProfileWritePayload = z.output<typeof profileWriteSchema>;

export type AffiliationTaxonomy = {
  universities: {
    id: string;
    name: string;
    faculties: { id: string; name: string; departments: { id: string; name: string }[] }[];
  }[];
};

export type ProfileFormValues = {
  name: string;
  title: string;
  bio: string;
  country: string;
  orcid: string;
  website: string;
  image: string;
  researchFields: string;
  universityId: string;
  facultyId: string;
  departmentId: string;
};

export function safeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

export function parseResearchFields(raw: string) {
  return [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function valuesToPayload(values: ProfileFormValues) {
  return profileWriteSchema.safeParse({
    name: values.name,
    title: values.title,
    bio: values.bio,
    country: values.country,
    orcid: values.orcid,
    website: values.website,
    image: values.image,
    researchFields: parseResearchFields(values.researchFields),
    universityId: values.universityId || null,
    departmentId: values.departmentId || null,
  });
}

export function flattenProfileErrors(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export const PROFILE_API_CONTRACT = {
  method: PROFILE_WRITE_METHOD,
  path: PROFILE_WRITE_PATH,
  auth: "session utilisateur ACTIVE, permission profile:write (compte propriétaire)",
  writable: [
    "User.name",
    "User.image (URL uniquement, pas d’upload GCS)",
    "Profile.title",
    "Profile.bio",
    "Profile.country",
    "Profile.orcid",
    "Profile.website",
    "Profile.researchFields",
    "Profile.universityId",
    "Profile.departmentId",
  ],
  notWritable: ["User.email", "User.role", "User.status", "Profile.facultyId (absent du modèle)"],
  validation: [
    "Si departmentId est fourni, l’université parente du département doit égaler universityId.",
    "La faculté n’est pas persistée : elle se déduit de Department.faculty.",
    "ORCID unique s’il est renseigné.",
    "Ne pas accepter un fichier binaire : le stockage GCS existant est privé et documentaire.",
  ],
  responses: {
    200: "{ user: { name, image }, profile: { ... } }",
    400: "{ error, fields? }",
    401: "{ error }",
    403: "{ error }",
    409: "{ error } (ORCID déjà utilisé)",
  },
} as const;
