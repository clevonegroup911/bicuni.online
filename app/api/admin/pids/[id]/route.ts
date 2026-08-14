import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { auditRequestContext } from "@/lib/admin/context";
import { pidAdminError } from "@/lib/pid/http";
import { PersistentIdentifierService } from "@/lib/pid/service";
import { adminPidIdSchema, updatePersistentIdentifierSchema } from "@/lib/pid/validators";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminApi("admin:pids:read", request);
    const id = adminPidIdSchema.safeParse((await params).id);
    if (!id.success) return NextResponse.json({ error: "Identifiant BICUNI introuvable." }, { status: 404 });
    return NextResponse.json(await new PersistentIdentifierService().getById(id.data, { id: actor.id, role: actor.role }));
  } catch (error) {
    return pidAdminError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminApi("admin:pids:manage", request);
    const id = adminPidIdSchema.safeParse((await params).id);
    if (!id.success) return NextResponse.json({ error: "Identifiant BICUNI introuvable." }, { status: 404 });
    const parsed = updatePersistentIdentifierSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Action d’identifiant invalide." }, { status: 400 });
    const service = new PersistentIdentifierService();
    const context = auditRequestContext(request);
    const admin = { id: actor.id, role: actor.role };
    if (parsed.data.action === "updateTarget") {
      return NextResponse.json(await service.updateTarget(id.data, admin, parsed.data.targetUrl, parsed.data.reason, context));
    }
    if (parsed.data.action === "deprecate") {
      return NextResponse.json(await service.deprecate(id.data, admin, parsed.data.reason, context));
    }
    return NextResponse.json(await service.tombstone(id.data, admin, parsed.data.reason, context));
  } catch (error) {
    return pidAdminError(error);
  }
}
