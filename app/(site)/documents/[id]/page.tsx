import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { CommentSection } from "@/components/documents/comment-section";
import { DownloadButton, FavoriteButton, ShareButton } from "@/components/documents/document-actions";
import { PersistentIdentifierBlock } from "@/components/documents/persistent-identifier";
import { PDFPreview } from "@/components/documents/pdf-preview";
import { StatusBadge } from "@/components/documents/status-badge";
import { VersionTimeline } from "@/components/documents/version-timeline";
import { ViewTracker } from "@/components/documents/view-tracker";
import { WorkflowActions } from "@/components/documents/workflow-actions";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { db } from "@/lib/db/client";
import { canArchiveDocument, canEditDocument, canReviewDocument } from "@/lib/documents/permissions";
import { canReadDocumentSecure } from "@/lib/documents/scope";
import { registeredDoi } from "@/lib/documents/doi";
import { buildResolverUrl } from "@/lib/pid/config";
import { findDocumentPrimaryPid } from "@/lib/pid/resource-binding";
import { privateStorage } from "@/lib/storage";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const id = (await params).id;
    const document = await db.document.findUnique({
      where: { id },
      select: { title: true, abstract: true, authorId: true, status: true, universityId: true },
    });
    if (!document) return { title: "Document" };
    const session = await auth();
    if (!(await canReadDocumentSecure(session?.user ?? null, document))) return { title: "Document" };
    return { title: document.title, description: document.abstract?.slice(0, 160) };
  } catch {
    return { title: "Document" };
  }
}

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const session = await auth();
  const document = await db.document.findUnique({
    where: { id },
    include: {
      author: { select: { name: true } },
      university: true,
      faculty: true,
      department: true,
      category: true,
      tags: true,
      files: { where: { isUploaded: true, scanStatus: "CLEAN" }, orderBy: { version: "desc" } },
      publication: true,
      history: { orderBy: { createdAt: "desc" } },
      comments: { where: { deletedAt: null }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!document || !(await canReadDocumentSecure(session?.user ?? null, document))) notFound();
  const pid = await findDocumentPrimaryPid(document.id);
  const doi = registeredDoi(document.publication?.internalDoi);
  const file = document.files[0];
  const favorited = session?.user?.id
    ? Boolean(await db.documentFavorite.findUnique({
      where: { userId_documentId: { userId: session.user.id, documentId: id } },
      select: { userId: true },
    }))
    : false;
  let previewUrl: string | undefined;
  if (file?.mimeType === "application/pdf" && session?.user) {
    previewUrl = await privateStorage().createSignedDownload(file.objectKey, file.fileName, 300, true);
  }
  const actions: ("submit" | "approve" | "reject" | "archive")[] = [];
  if (session?.user?.id === document.authorId && document.status === "DRAFT") actions.push("submit");
  if (session?.user && canReviewDocument(session.user) && document.status === "PENDING_REVIEW") actions.push("approve", "reject");
  if (session?.user && canArchiveDocument(session.user, document)) actions.push("archive");

  return (
    <main className="shell document-detail">
      <ViewTracker documentId={id} />
      <header className="page-hero">
        <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Documents", href: "/documents" }, { label: document.title }]} />
        <div className="document-card-top">
          <span className="eyebrow">{document.type} · {document.academicYear}</span>
          <StatusBadge status={document.status} />
        </div>
        <h1>{document.title}</h1>
        <p>{document.author.name ?? "Non renseigné"} · {document.university?.name ?? "Institution indépendante"}</p>
        <div className="document-toolbar">
          {file ? <DownloadButton fileId={file.id} /> : null}
          <FavoriteButton documentId={id} initialFavorited={favorited} />
          <ShareButton title={document.title} />
          {session?.user && canEditDocument(session.user, document) ? (
            <Link className="button secondary" href={`/documents/${id}/edit`}>Modifier</Link>
          ) : null}
        </div>
        <WorkflowActions documentId={id} actions={actions} />
      </header>
      <div className="document-detail-grid">
        <section>
          <PDFPreview
            url={previewUrl}
            title={document.title}
            hasFile={Boolean(file)}
            loginHref={session?.user ? undefined : `/login?next=${encodeURIComponent(`/documents/${id}`)}`}
          />
          <article className="document-copy">
            <h2>Résumé</h2>
            <p>{document.abstract ?? "Aucun résumé n’a été fourni."}</p>
            <h2>Mots-clés</h2>
            <div>{document.tags.length ? document.tags.map((tag) => <span className="status-badge" key={tag.id}>{tag.name}</span>) : <p className="muted">Aucun mot-clé.</p>}</div>
          </article>
          <CommentSection
            documentId={id}
            signedIn={Boolean(session?.user)}
            initialComments={document.comments.map((comment) => ({ ...comment, createdAt: comment.createdAt.toISOString() }))}
          />
        </section>
        <aside className="glass card metadata-aside">
          <h2>Métadonnées</h2>
          <dl>
            <dt>Auteur</dt>
            <dd>{document.author.name ?? "Non renseigné"}</dd>
            <dt>Université</dt>
            <dd>{document.university?.name ?? "—"}</dd>
            <dt>Faculté</dt>
            <dd>{document.faculty?.name ?? "—"}</dd>
            <dt>Département</dt>
            <dd>{document.department?.name ?? "—"}</dd>
            <dt>Promotion</dt>
            <dd>{document.promotion ?? "—"}</dd>
            <dt>Catégorie</dt>
            <dd>{document.category.name}</dd>
            <dt>Licence</dt>
            <dd>{document.license}</dd>
            <dt>Date</dt>
            <dd>{(document.publishedAt ?? document.updatedAt).toLocaleDateString("fr-FR")}</dd>
            <dt>Statut</dt>
            <dd><StatusBadge status={document.status} /></dd>
          </dl>
          {pid ? (
            <PersistentIdentifierBlock identifier={pid.identifier} href={buildResolverUrl(pid.identifier)} />
          ) : (
            <p className="muted">Aucun PID BICUNI n’est encore associé à ce document.</p>
          )}
          {doi ? (
            <dl>
              <dt>DOI enregistré</dt>
              <dd>{doi}</dd>
            </dl>
          ) : null}
          <h2>Historique</h2>
          <VersionTimeline events={document.history} />
        </aside>
      </div>
    </main>
  );
}
