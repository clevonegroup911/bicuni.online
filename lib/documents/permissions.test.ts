import { describe, expect, it } from "vitest";
import {
  canArchiveDocument,
  canEditDocument,
  canManageDocumentsGlobally,
  canReadDocument,
  canReviewDocument,
  canSubmitDocument,
  isInstitutionScopedDocumentRole,
  toDocumentResource,
} from "./permissions";

const student = { id: "student-1", role: "STUDENT" as const };
const researcher = { id: "researcher-1", role: "RESEARCHER" as const };
const universityAdmin = { id: "admin-1", role: "UNIVERSITY_ADMIN" as const };
const institutionAdmin = { id: "ia-1", role: "INSTITUTION_ADMIN" as const };
const moderator = { id: "mod-1", role: "MODERATOR" as const };
const admin = { id: "adm-1", role: "ADMIN" as const };
const superAdmin = { id: "root-1", role: "SUPER_ADMIN" as const };
const user = { id: "user-1", role: "USER" as const };

describe("permissions documentaires", () => {
  it("autorise uniquement le propriétaire à modifier son brouillon", () => {
    const draft = { authorId: student.id, status: "DRAFT" as const };
    expect(canEditDocument(student, draft)).toBe(true);
    expect(canEditDocument(researcher, draft)).toBe(false);
    expect(canEditDocument(superAdmin, draft)).toBe(true);
  });

  it("interdit l’édition après soumission", () => {
    expect(canEditDocument(student, { authorId: student.id, status: "PENDING_REVIEW" })).toBe(false);
  });

  it("autorise la soumission du brouillon par son propriétaire", () => {
    expect(canSubmitDocument(student, { authorId: student.id, status: "DRAFT" })).toBe(true);
  });

  it("réserve la validation aux rôles administratifs autorisés", () => {
    expect(canReviewDocument(student)).toBe(false);
    expect(canReviewDocument(user)).toBe(false);
    expect(canReviewDocument(researcher)).toBe(false);
    expect(canReviewDocument(moderator)).toBe(true);
    expect(canReviewDocument(admin)).toBe(true);
    expect(canReviewDocument(universityAdmin)).toBe(true);
    expect(canReviewDocument(superAdmin)).toBe(true);
  });

  it("n’autorise l’archivage que depuis APPROVED ou PUBLISHED", () => {
    expect(canArchiveDocument(universityAdmin, { authorId: student.id, status: "APPROVED" })).toBe(true);
    expect(canArchiveDocument(admin, { authorId: student.id, status: "PUBLISHED" })).toBe(true);
    expect(canArchiveDocument(moderator, { authorId: student.id, status: "APPROVED" })).toBe(false);
    expect(canArchiveDocument(superAdmin, { authorId: student.id, status: "DRAFT" })).toBe(false);
    expect(canArchiveDocument(superAdmin, { authorId: student.id, status: "PENDING_REVIEW" })).toBe(false);
    expect(canArchiveDocument(superAdmin, { authorId: student.id, status: "REJECTED" })).toBe(false);
  });

  it("exige un DocumentResource complet (authorId + status) pour l’archivage", () => {
    const resource = toDocumentResource({ authorId: "author-1", status: "APPROVED" });
    expect(resource).toEqual({ authorId: "author-1", status: "APPROVED", universityId: undefined });
    expect(canArchiveDocument(superAdmin, resource)).toBe(true);
    expect(canArchiveDocument(superAdmin, toDocumentResource({ authorId: "author-1", status: "DRAFT" }))).toBe(false);
  });

  it("isole la lecture privée des INSTITUTION_ADMIN sans périmètre", () => {
    const pending = { authorId: student.id, status: "PENDING_REVIEW" as const, universityId: "uni-2" };
    expect(canReadDocument(institutionAdmin, pending)).toBe(false);
    expect(canReadDocument(institutionAdmin, pending, ["uni-1"])).toBe(false);
    expect(canReadDocument(institutionAdmin, pending, ["uni-2"])).toBe(true);
    expect(canReadDocument(moderator, pending)).toBe(true);
    expect(canReadDocument(null, pending)).toBe(false);
    expect(canReadDocument(null, { authorId: student.id, status: "PUBLISHED" })).toBe(true);
  });

  it("distingue accès global et rôles institutionnels", () => {
    expect(canManageDocumentsGlobally("SUPER_ADMIN")).toBe(true);
    expect(canManageDocumentsGlobally("ADMIN")).toBe(true);
    expect(canManageDocumentsGlobally("MODERATOR")).toBe(true);
    expect(canManageDocumentsGlobally("INSTITUTION_ADMIN")).toBe(false);
    expect(isInstitutionScopedDocumentRole("UNIVERSITY_ADMIN")).toBe(true);
    expect(isInstitutionScopedDocumentRole("USER")).toBe(false);
  });
});
