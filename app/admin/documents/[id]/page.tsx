import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { DocumentReviewActions } from "@/components/admin/document-review-actions";
import { DownloadButton } from "@/components/documents/document-actions";
import { requirePermission } from "@/lib/auth/guards";
import { AdminDocumentError, AdminDocumentService, formatFileSize } from "@/lib/admin/document-admin-service";

export const metadata = { title: "Fiche document" };

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_REVIEW: "En attente",
  APPROVED: "Approuvé",
  PUBLISHED: "Publié",
  REJECTED: "Rejeté",
  ARCHIVED: "Archivé",
};

function text(value: string | null | undefined) {
  return value?.trim() ? value : "—";
}

function name(value: string | null | undefined) {
  return value?.trim() ? value : "Non renseigné";
}

export default async function AdminDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("admin:documents:review");
  const { id } = await params;
  let document;
  try {
    document = await new AdminDocumentService().getById(user.id, user.role, id);
  } catch (error) {
    if (error instanceof AdminDocumentError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }

  const versions = [...new Map(document.files.map((file) => [file.version, file])).values()];

  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title admin-title-row">
          <div>
            <span className="eyebrow">Fiche document</span>
            <h1>{document.title}</h1>
            <p>
              {document.type} · {STATUS_LABELS[document.status] ?? document.status}
            </p>
          </div>
          <div className="admin-institution-header-actions">
            <Link className="button secondary" href="/admin/documents">Liste</Link>
            <DocumentReviewActions
              documentId={document.id}
              canReview={document.canReview}
              canArchive={document.canArchive}
            />
          </div>
        </header>

        <section className="admin-dashboard-grid">
          <article className="glass card admin-panel">
            <h2>Informations principales</h2>
            <div className="admin-row"><span><strong>Statut</strong></span><span className={`admin-status ${document.status.toLowerCase()}`}>{STATUS_LABELS[document.status] ?? document.status}</span></div>
            <div className="admin-row"><span><strong>Type</strong></span><span>{document.type}</span></div>
            <div className="admin-row"><span><strong>Langue</strong></span><span>{text(document.language)}</span></div>
            <div className="admin-row"><span><strong>Année académique</strong></span><span>{text(document.academicYear)}</span></div>
            <div className="admin-row"><span><strong>Licence</strong></span><span>{text(document.license)}</span></div>
            <div className="admin-row"><span><strong>Catégorie</strong></span><span>{name(document.category?.name)}</span></div>
            <div className="admin-row"><span><strong>DOI</strong></span><span>{text(document.doi)}</span></div>
          </article>

          <article className="glass card admin-panel">
            <h2>Auteur et institution</h2>
            <div className="admin-row"><span><strong>Auteur</strong></span><span>{name(document.author.name)}</span></div>
            <div className="admin-row"><span><strong>Institution</strong></span><span>{name(document.university?.name)}</span></div>
            <div className="admin-row"><span><strong>Faculté</strong></span><span>{text(document.faculty?.name)}</span></div>
            <div className="admin-row"><span><strong>Département</strong></span><span>{text(document.department?.name)}</span></div>
            <div className="admin-row"><span><strong>Version actuelle</strong></span><span>v{document.currentVersion}</span></div>
          </article>

          <article className="glass card admin-panel">
            <h2>Dates</h2>
            <div className="admin-row"><span><strong>Création</strong></span><time>{document.createdAt.toLocaleString("fr-FR")}</time></div>
            <div className="admin-row"><span><strong>Mise à jour</strong></span><time>{document.updatedAt.toLocaleString("fr-FR")}</time></div>
            <div className="admin-row"><span><strong>Publication</strong></span><span>{document.publishedAt ? document.publishedAt.toLocaleString("fr-FR") : "—"}</span></div>
          </article>

          <article className="glass card admin-panel">
            <h2>Statistiques</h2>
            <div className="admin-row"><span><strong>Vues</strong></span><strong>{document.viewCount}</strong></div>
            <div className="admin-row"><span><strong>Téléchargements</strong></span><strong>{document.downloadCount}</strong></div>
            <div className="admin-row"><span><strong>Favoris</strong></span><strong>{document.favoriteCount}</strong></div>
            <div className="admin-row"><span><strong>Commentaires</strong></span><strong>{document.commentCount}</strong></div>
          </article>

          <article className="glass card admin-panel admin-panel-wide">
            <h2>Résumé</h2>
            <p>{text(document.abstract)}</p>
          </article>

          {document.status === "REJECTED" ? (
            <article className="glass card admin-panel admin-panel-wide">
              <h2>Motif de rejet</h2>
              <p>{text(document.rejectionReason)}</p>
            </article>
          ) : null}

          <article className="glass card admin-panel admin-panel-wide">
            <h2>Fichiers associés</h2>
            {document.files.length === 0 ? (
              <p><small>Aucun fichier associé.</small></p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Type MIME</th>
                      <th>Taille</th>
                      <th>Checksum</th>
                      <th>Version</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {document.files.map((file) => (
                      <tr key={file.id}>
                        <td><strong>{file.fileName}</strong></td>
                        <td>{file.mimeType}</td>
                        <td>{formatFileSize(file.sizeBytes)}</td>
                        <td><code className="admin-checksum">{file.checksum || "—"}</code></td>
                        <td>v{file.version}</td>
                        <td>{file.scanStatus === "CLEAN" ? <DownloadButton fileId={file.id} /> : <small>{file.scanStatus === "REJECTED" ? "Fichier rejeté" : "Analyse requise"}</small>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="glass card admin-panel">
            <h2>Versions</h2>
            {versions.length === 0 ? <p><small>Aucune version fichier.</small></p> : null}
            {versions.map((file) => (
              <div className="admin-row" key={`${file.version}-${file.id}`}>
                <span>
                  <strong>v{file.version}</strong>
                  <small>{file.fileName}</small>
                </span>
                <time>{file.createdAt.toLocaleString("fr-FR")}</time>
              </div>
            ))}
          </article>

          <article className="glass card admin-panel">
            <h2>Revues</h2>
            {document.reviews.length === 0 ? <p><small>Aucune revue.</small></p> : null}
            {document.reviews.map((review) => (
              <div className="admin-row" key={review.id}>
                <span>
                  <strong>{review.decision}</strong>
                  <small>{name(review.reviewer.name)}{review.comment ? ` · ${review.comment}` : ""}</small>
                </span>
                <time>{review.createdAt.toLocaleString("fr-FR")}</time>
              </div>
            ))}
          </article>

          <article className="glass card admin-panel admin-panel-wide">
            <h2>Historique</h2>
            {document.history.length === 0 ? <p><small>Aucun historique.</small></p> : null}
            {document.history.map((event) => (
              <div className="admin-row" key={event.id}>
                <span>
                  <strong>{event.action}</strong>
                  <small>
                    {event.fromStatus ?? "—"} → {event.toStatus ?? "—"} · v{event.version}
                    {event.actor?.name ? ` · ${event.actor.name}` : event.actor?.email ? ` · ${event.actor.email}` : ""}
                    {event.comment ? ` · ${event.comment}` : ""}
                  </small>
                </span>
                <time>{event.createdAt.toLocaleString("fr-FR")}</time>
              </div>
            ))}
          </article>
        </section>
      </div>
    </AdminShell>
  );
}
