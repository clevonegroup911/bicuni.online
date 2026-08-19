import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { privateStorage } from "@/lib/storage";
import { isCleanUploadedFile } from "@/lib/documents/file-scan";
import { canReadDocumentSecure } from "@/lib/documents/scope";

const actionSchema = z.enum(["download", "preview"]);

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const file = await db.documentFile.findUnique({
    where: { id: (await params).fileId },
    include: {
      document: {
        select: { id: true, authorId: true, status: true, universityId: true, deletedAt: true },
      },
    },
  });
  if (!file || file.document.status === "DELETED" || file.document.deletedAt) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }
  if (!isCleanUploadedFile(file)) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  const allowed = await canReadDocumentSecure(session.user, file.document);
  if (!allowed) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });

  const action = actionSchema.catch("download").parse(new URL(request.url).searchParams.get("action"));
  const url = await privateStorage().createSignedDownload(file.objectKey, file.fileName, 5 * 60, action === "preview");
  if (action === "download") {
    await db.document.update({ where: { id: file.documentId }, data: { downloadCount: { increment: 1 } } });
  }
  return NextResponse.json({ url, expiresIn: 300 });
}

export async function DELETE() {
  return NextResponse.json(
    { error: "La suppression physique des fichiers est désactivée." },
    { status: 405, headers: { Allow: "GET" } },
  );
}
