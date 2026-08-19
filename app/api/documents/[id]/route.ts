import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { DocumentDomainError, DocumentService, documentInclude, sanitizeDocumentForClient } from "@/lib/documents/document-service";
import { isCleanUploadedFile } from "@/lib/documents/file-scan";
import { canReviewDocument } from "@/lib/documents/permissions";
import { canReadDocumentSecure } from "@/lib/documents/scope";
import { documentUpdateSchema } from "@/lib/validators/document";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); const id = (await params).id;
  const document = await db.document.findUnique({ where: { id }, include: { ...documentInclude, history: { orderBy: { createdAt: "desc" } }, reviews: { include: { reviewer: { select: { name: true } } } } } });
  if (!document || !(await canReadDocumentSecure(session?.user ?? null, document))) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  const privileged = Boolean(session?.user && (session.user.id === document.authorId || canReviewDocument(session.user)));
  const files = privileged ? document.files : document.files.filter(isCleanUploadedFile);
  return NextResponse.json(sanitizeDocumentForClient({ ...document, files }));
}
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const parsed = documentUpdateSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Données invalides.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  try { return NextResponse.json(sanitizeDocumentForClient(await new DocumentService().update((await params).id, session.user, parsed.data))); } catch (error) { return domainError(error); }
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try { await new DocumentService().softDelete((await params).id, session.user); return new NextResponse(null, { status: 204 }); } catch (error) { return domainError(error); }
}
function domainError(error: unknown) { return error instanceof DocumentDomainError ? NextResponse.json({ error: error.message }, { status: error.status }) : NextResponse.json({ error: "Erreur interne." }, { status: 500 }); }
