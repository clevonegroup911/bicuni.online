import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { canReadDocumentSecure } from "@/lib/documents/scope";
import { commentSchema } from "@/lib/validators/document";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); const id = (await params).id;
  const document = await db.document.findUnique({ where: { id }, select: { authorId: true, status: true, universityId: true } });
  if (!document || !(await canReadDocumentSecure(session?.user ?? null, document))) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  return NextResponse.json(await db.documentComment.findMany({ where: { documentId: id, deletedAt: null }, include: { author: { select: { name: true } }, }, orderBy: { createdAt: "asc" } }));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const parsed = commentSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Commentaire invalide." }, { status: 400 });
  const id = (await params).id; const document = await db.document.findUnique({ where: { id }, select: { authorId: true, status: true, universityId: true } });
  if (!document || !(await canReadDocumentSecure(session.user, document))) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  const comment = await db.$transaction(async (tx) => { const created = await tx.documentComment.create({ data: { documentId: id, authorId: session.user.id, body: parsed.data.body }, include: { author: { select: { name: true } } } }); await tx.document.update({ where: { id }, data: { commentCount: { increment: 1 } } }); return created; });
  return NextResponse.json(comment, { status: 201 });
}
