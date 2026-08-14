import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { consumeAuthAttempt, requestIdentity } from "@/lib/auth/rate-limit";
import { hasActiveSubscription } from "@/lib/subscriptions/service";
import { privateStorage, safeObjectKey } from "@/lib/storage";
import { documentUploadSchema } from "@/lib/validators/document";
import { assertCanCreate, slugify } from "@/lib/documents/document-service";
import { logger } from "@/lib/observability/logger";
import { deleteUnboundDocument } from "@/lib/pid/resource-binding";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  assertCanCreate(session.user);
  if (session.user.role !== "SUPER_ADMIN" && !await hasActiveSubscription(session.user.id)) {
    return NextResponse.json({ error: "Abonnement actif requis." }, { status: 403 });
  }
  if (!consumeAuthAttempt(`upload:${session.user.id}:${requestIdentity(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
  }

  const parsed = documentUploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides.", details: parsed.error.flatten() }, { status: 400 });
  }
  const category = await db.category.findUnique({ where: { id: parsed.data.categoryId }, select: { id: true } });
  if (!category) return NextResponse.json({ error: "Catégorie inconnue." }, { status: 400 });

  const objectKey = safeObjectKey(session.user.id, parsed.data.fileName);
  const document = await db.document.create({
    data: {
      slug: `${slugify(parsed.data.title)}-${crypto.randomUUID().slice(0, 8)}`,
      title: parsed.data.title,
      abstract: parsed.data.abstract,
      universityId: parsed.data.universityId,
      facultyId: parsed.data.facultyId,
      departmentId: parsed.data.departmentId,
      categoryId: parsed.data.categoryId,
      promotion: parsed.data.promotion,
      academicYear: parsed.data.academicYear,
      year: parsed.data.year,
      language: parsed.data.language,
      type: parsed.data.type,
      license: parsed.data.license,
      authorId: session.user.id,
      tags: { connectOrCreate: parsed.data.keywords.map((name) => ({ where: { slug: slugify(name) }, create: { name, slug: slugify(name) } })) },
      history: { create: { actorId: session.user.id, action: "CREATED", toStatus: "DRAFT", version: 1 } },
      files: {
        create: {
          objectKey,
          fileName: parsed.data.fileName,
          mimeType: parsed.data.mimeType,
          sizeBytes: parsed.data.sizeBytes,
          checksum: parsed.data.checksum,
          isUploaded: false,
        },
      },
    },
    include: { files: true },
  });
  try {
    const thumbnailObjectKey = `thumbnails/${document.id}/cover.svg`;
    await privateStorage().createThumbnail(thumbnailObjectKey, document.title, parsed.data.type);
    await db.document.update({ where: { id: document.id }, data: { thumbnailObjectKey } });
    const uploadUrl = await privateStorage().createSignedUpload({
      objectKey,
      contentType: parsed.data.mimeType,
      expiresInSeconds: 15 * 60,
    });
    return NextResponse.json({ documentId: document.id, fileId: document.files[0].id, uploadUrl }, { status: 201 });
  } catch (error) {
    logger.error("gcs.upload_initialization_error", error, { documentId: document.id, userId: session.user.id });
    await deleteUnboundDocument(document.id);
    throw error;
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const body = await request.json().catch(() => null) as { fileId?: string } | null;
  if (!body?.fileId) return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });
  const file = await db.documentFile.findUnique({ where: { id: body.fileId }, include: { document: true } });
  if (!file) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  if (file.document.authorId !== session.user.id && session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  const stored = await privateStorage().stat(file.objectKey);
  if (!stored.exists || stored.sizeBytes !== file.sizeBytes || stored.contentType !== file.mimeType) {
    return NextResponse.json({ error: "Le fichier stocké ne correspond pas aux métadonnées annoncées." }, { status: 422 });
  }
  await db.documentFile.update({ where: { id: file.id }, data: { isUploaded: true } });
  return NextResponse.json({ confirmed: true });
}
