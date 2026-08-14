import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { pidAdminError } from "@/lib/pid/http";
import { PersistentIdentifierService } from "@/lib/pid/service";
import { adminPidHistoryQuerySchema, adminPidIdSchema } from "@/lib/pid/validators";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminApi("admin:pids:read", request);
    const id = adminPidIdSchema.safeParse((await params).id);
    if (!id.success) return NextResponse.json({ error: "Identifiant BICUNI introuvable." }, { status: 404 });
    const parsed = adminPidHistoryQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Filtres d’historique invalides." }, { status: 400 });
    return NextResponse.json(await new PersistentIdentifierService().history(id.data, { id: actor.id, role: actor.role }, parsed.data));
  } catch (error) {
    return pidAdminError(error);
  }
}
