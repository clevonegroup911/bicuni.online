import type { DocumentStatus } from "@prisma/client";
const labels: Record<DocumentStatus, string> = { DRAFT: "Brouillon", PENDING_REVIEW: "En validation", APPROVED: "Publié", PUBLISHED: "Publié", REJECTED: "Rejeté", ARCHIVED: "Archivé", DELETED: "Supprimé" };
export function StatusBadge({ status }: { status: DocumentStatus }) { return <span className={`status-badge status-${status.toLowerCase()}`}>{labels[status]}</span>; }
