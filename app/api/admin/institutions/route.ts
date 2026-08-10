import { NextResponse } from "next/server";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { auditRequestContext } from "@/lib/admin/context";
import { AdminInstitutionError, AdminInstitutionService } from "@/lib/admin/institution-service";
import { institutionWriteSchema, parseAdminInstitutionQuery } from "@/lib/admin/validators";

export async function GET(request: Request) {
  try {
    const actor = await requireAdminApi("admin:institutions:read", request);
    const parsed = parseAdminInstitutionQuery(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Filtres invalides." }, { status: 400 });
    return NextResponse.json(await new AdminInstitutionService().list({ actorId: actor.id, actorRole: actor.role, ...parsed.data }));
  } catch (error) {
    return institutionError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminApi("admin:institutions:manage", request);
    const parsed = institutionWriteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données d’institution invalides.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const institution = await new AdminInstitutionService().create(
      actor.id,
      actor.role,
      parsed.data,
      auditRequestContext(request),
    );
    return NextResponse.json(institution, { status: 201 });
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
