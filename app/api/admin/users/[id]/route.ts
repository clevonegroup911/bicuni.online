import { NextResponse } from "next/server";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { auditRequestContext } from "@/lib/admin/context";
import { AdminUserError, AdminUserService } from "@/lib/admin/user-admin-service";
import { updateAdminUserSchema } from "@/lib/admin/validators";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminApi("admin:users:manage", request);
    const parsed = updateAdminUserSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Action administrative invalide." }, { status: 400 });
    const targetId = (await params).id;
    const context = auditRequestContext(request);
    const service = new AdminUserService();
    const user = parsed.data.action === "role"
      ? await service.changeRole(actor.id, actor.role, targetId, parsed.data.role, context)
      : await service.changeStatus(actor.id, actor.role, targetId, parsed.data.status, context);
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof AdminUserError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Erreur administrative interne." }, { status: 500 });
  }
}
