import { NextResponse } from "next/server";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { auditRequestContext } from "@/lib/admin/context";
import { AdminUserError, AdminUserService } from "@/lib/admin/user-admin-service";
import { adminUserQuerySchema, createAdminSchema } from "@/lib/admin/validators";

export async function GET(request: Request) {
  try {
    await requireAdminApi("admin:users:read", request);
    const parsed = adminUserQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Filtres invalides." }, { status: 400 });
    return NextResponse.json(await new AdminUserService().list(parsed.data));
  } catch (error) { return adminError(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminApi("admin:users:manage", request);
    const parsed = createAdminSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données administrateur invalides.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const user = await new AdminUserService().createAdministrator(actor.id, actor.role, parsed.data, auditRequestContext(request));
    return NextResponse.json(user, { status: 201 });
  } catch (error) { return adminError(error); }
}

function adminError(error: unknown) {
  if (error instanceof AdminAuthorizationError || error instanceof AdminUserError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: "Erreur administrative interne." }, { status: 500 });
}
