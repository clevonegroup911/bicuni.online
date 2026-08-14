import type { Role } from "@prisma/client";
import { db } from "../db/client";
import {
  canManageDocumentsGlobally,
  canReviewDocument,
  isInstitutionScopedDocumentRole,
  type DocumentActor,
} from "@/lib/documents/permissions";

export { canManageDocumentsGlobally, isInstitutionScopedDocumentRole };

/** `null` = accès global. Tableau = institutions administrées. */
export async function managedDocumentInstitutionIds(actorId: string, actorRole: Role): Promise<string[] | null> {
  if (canManageDocumentsGlobally(actorRole)) return null;
  if (!isInstitutionScopedDocumentRole(actorRole)) return [];
  const managed = await db.university.findMany({
    where: { admins: { some: { id: actorId } } },
    select: { id: true },
    orderBy: [{ id: "asc" }],
  });
  return managed.map((item) => item.id);
}

export function isDocumentInAdminScope(
  document: { universityId: string | null },
  scope: string[] | null,
) {
  if (scope === null) return true;
  if (!document.universityId) return false;
  return scope.includes(document.universityId);
}

export async function canReadDocumentSecure(
  actor: DocumentActor | null,
  document: { authorId: string; status: string; universityId: string | null },
) {
  if (document.status === "APPROVED" || document.status === "PUBLISHED") return true;
  if (!actor) return false;
  if (actor.id === document.authorId) return true;
  if (!canReviewDocument(actor)) return false;
  const scope = await managedDocumentInstitutionIds(actor.id, actor.role);
  return isDocumentInAdminScope(document, scope);
}
