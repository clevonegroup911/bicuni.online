import { NextResponse } from "next/server";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { AdminDocumentError, AdminDocumentService } from "@/lib/admin/document-admin-service";
import { parseAdminDocumentQuery } from "@/lib/admin/validators";

export async function GET(request: Request) {
  try {
    const actor = await requireAdminApi("admin:documents:review", request);
    const parsed = parseAdminDocumentQuery(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Filtres invalides." }, { status: 400 });
    const service = new AdminDocumentService();
    const [list, statistics] = await Promise.all([
      service.list({ actorId: actor.id, actorRole: actor.role, ...parsed.data }),
      service.statistics(actor.id, actor.role),
    ]);
    return NextResponse.json({ ...list, statistics });
  } catch (error) {
    return documentAdminError(error);
  }
}

function documentAdminError(error: unknown) {
  if (error instanceof AdminAuthorizationError || error instanceof AdminDocumentError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Erreur administrative interne." }, { status: 500 });
}
