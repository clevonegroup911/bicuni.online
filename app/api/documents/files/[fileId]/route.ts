import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { privateStorage } from "@/lib/storage";
import { canEditDocument } from "@/lib/documents/permissions";

const actionSchema = z.enum(["download", "preview"]);

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const file = await db.documentFile.findUnique({
    where: { id: (await params).fileId },
    include: { document: { select: { authorId: true, status: true } } },
  });
  if (!file) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  const allowed = ["APPROVED", "PUBLISHED"].includes(file.document.status) || file.document.authorId === session.user.id || session.user.role === "SUPER_ADMIN";
  if (!allowed) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const action = actionSchema.catch("download").parse(new URL(request.url).searchParams.get("action"));
  const url = await privateStorage().createSignedDownload(file.objectKey, file.fileName, 5 * 60, action === "preview");
  if (action === "download") {
    await db.document.update({ where: { id: file.documentId }, data: { downloadCount: { increment: 1 } } });
  }
  return NextResponse.json({ url, expiresIn: 300 });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const file = await db.documentFile.findUnique({ where: { id: (await params).fileId }, include: { document: true } });
  if (!file) return new NextResponse(null, { status: 204 });
  if (!canEditDocument(session.user, file.document)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  await privateStorage().delete(file.objectKey);
  await db.documentFile.delete({ where: { id: file.id } });
  return new NextResponse(null, { status: 204 });
}
