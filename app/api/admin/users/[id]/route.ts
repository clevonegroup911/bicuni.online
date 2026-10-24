import { NextResponse } from "next/server";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { auditRequestContext } from "@/lib/admin/context";
import { AdminUserError, AdminUserService } from "@/lib/admin/user-admin-service";
import { updateAdminUserSchema } from "@/lib/admin/validators";
import { publicOrigin } from "@/lib/http/public-origin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminApi("admin:users:manage", request);
    const parsed = updateAdminUserSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Action administrative invalide." }, { status: 400 });
    const targetId = (await params).id;
    const context = auditRequestContext(request);
    const service = new AdminUserService();

    if (parsed.data.action === "role") {
      const user = await service.changeRole(actor.id, actor.role, targetId, parsed.data.role, context);
      return NextResponse.json(user);
    }
    if (parsed.data.action === "resend_verification") {
      const result = await service.resendVerification(
        actor.id,
        actor.role,
        targetId,
        publicOrigin(request),
        context,
      );
      return NextResponse.json(result);
    }
    const user = await service.changeStatus(actor.id, actor.role, targetId, parsed.data.status, context);
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof AdminUserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erreur administrative interne." }, { status: 500 });
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminApi("admin:users:read", request);
    const targetId = (await params).id;
    const url = new URL(request.url);
    if (url.searchParams.get("events") !== "1") {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }
    // Lecture des événements de sécurité : SUPER_ADMIN ou permission users:read déjà vérifiée.
    void actor;
    const events = await new AdminUserService().listSecurityEvents(targetId);
    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof AdminAuthorizationError || error instanceof AdminUserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Erreur administrative interne." }, { status: 500 });
  }
}
