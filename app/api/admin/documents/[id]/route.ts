import { NextResponse } from "next/server";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { auditRequestContext } from "@/lib/admin/context";
import { AdminDocumentError, AdminDocumentService } from "@/lib/admin/document-admin-service";
import { adminDocumentIdSchema, updateAdminDocumentSchema } from "@/lib/admin/validators";
import { DocumentDomainError } from "@/lib/documents/document-service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminApi("admin:documents:review", request);
    const id = adminDocumentIdSchema.safeParse((await params).id);
    if (!id.success) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    return NextResponse.json(await new AdminDocumentService().getById(actor.id, actor.role, id.data));
  } catch (error) {
    return adminDocumentMutationError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminApi("admin:documents:review", request);
    const id = adminDocumentIdSchema.safeParse((await params).id);
    if (!id.success) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
    const parsed = updateAdminDocumentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Action documentaire invalide." }, { status: 400 });
    const service = new AdminDocumentService();
    const context = auditRequestContext(request);
    const result = parsed.data.action === "archive"
      ? await service.archive(actor.id, actor.role, id.data, context)
      : await service.review(actor.id, actor.role, id.data, parsed.data.review, context);
    return NextResponse.json(result);
  } catch (error) {
    return adminDocumentMutationError(error);
  }
}

function adminDocumentMutationError(error: unknown) {
  if (error instanceof DocumentDomainError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof AdminAuthorizationError || error instanceof AdminDocumentError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Erreur administrative interne." }, { status: 500 });
}
