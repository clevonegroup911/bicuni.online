import { z } from "zod";

export const documentMetadataSchema = z.object({
  title: z.string().trim().min(5).max(240),
  abstract: z.string().trim().min(20).max(5000),
  universityId: z.string().cuid().optional().nullable(),
  facultyId: z.string().cuid().optional().nullable(),
  departmentId: z.string().cuid().optional().nullable(),
  categoryId: z.string().cuid(),
  promotion: z.string().trim().max(120).optional().nullable(),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  year: z.coerce.number().int().min(1800).max(new Date().getFullYear() + 1),
  language: z.string().trim().min(2).max(12).default("fr"),
  type: z.enum(["TFC", "MEMOIRE", "THESE", "ARTICLE", "RAPPORT"]),
  license: z.string().trim().min(2).max(120),
  keywords: z.array(z.string().trim().min(2).max(60)).min(1).max(20),
});

export const documentUploadSchema = documentMetadataSchema.extend({
  mimeType: z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
  fileName: z.string().trim().min(1).max(180),
  sizeBytes: z.number().int().positive().max(Number(process.env.DOCUMENT_MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024)),
  checksum: z.string().regex(/^[a-f0-9]{64}$/i, "Empreinte SHA-256 invalide."),
});

export const documentUpdateSchema = documentMetadataSchema.partial().refine((value) => Object.keys(value).length > 0);
export const reviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVED"), comment: z.string().trim().max(2000).optional() }),
  z.object({ decision: z.literal("REJECTED"), comment: z.string().trim().min(10).max(2000) }),
]);
export const commentSchema = z.object({ body: z.string().trim().min(2).max(3000) });
