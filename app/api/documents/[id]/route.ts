import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { DocumentDomainError, DocumentService, documentInclude, sanitizeDocumentForClient } from "@/lib/documents/document-service";
import { canReadDocumentSecure } from "@/lib/documents/scope";
import { documentUpdateSchema } from "@/lib/validators/document";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); const id = (await params).id;
  const document = await db.document.findUnique({ where: { id }, include: { ...documentInclude, history: { orderBy: { createdAt: "desc" } }, reviews: { include: { reviewer: { select: { name: true } } } } } });
  if (!document || !(await canReadDocumentSecure(session?.user ?? null, document))) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  return NextResponse.json(sanitizeDocumentForClient(document));
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
