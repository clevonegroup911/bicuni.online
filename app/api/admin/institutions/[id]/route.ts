import { NextResponse } from "next/server";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { auditRequestContext } from "@/lib/admin/context";
import { AdminInstitutionError, AdminInstitutionService } from "@/lib/admin/institution-service";
import { updateInstitutionSchema } from "@/lib/admin/validators";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminApi("admin:institutions:read", request);
    const institution = await new AdminInstitutionService().getById(actor.id, actor.role, (await params).id);
    return NextResponse.json(institution);
  } catch (error) {
    return institutionError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminApi("admin:institutions:manage", request);
    const parsed = updateInstitutionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Action institutionnelle invalide." }, { status: 400 });
    const id = (await params).id;
    const context = auditRequestContext(request);
    const service = new AdminInstitutionService();
    const institution = parsed.data.action === "status"
      ? await service.changeStatus(actor.id, actor.role, id, parsed.data.status, context)
      : await service.update(actor.id, actor.role, id, parsed.data, context);
    return NextResponse.json(institution);
  } catch (error) {
    return institutionError(error);
  }
}

function institutionError(error: unknown) {
  if (error instanceof AdminAuthorizationError || error instanceof AdminInstitutionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "Erreur administrative interne." }, { status: 500 });
}
