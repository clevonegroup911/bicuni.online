import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { auditRequestContext } from "@/lib/admin/context";
import { pidAdminError } from "@/lib/pid/http";
import { PersistentIdentifierService } from "@/lib/pid/service";
import { adminPidQuerySchema, createPersistentIdentifierSchema } from "@/lib/pid/validators";

export async function GET(request: Request) {
  try {
    const actor = await requireAdminApi("admin:pids:read", request);
    const parsed = adminPidQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Filtres invalides." }, { status: 400 });
    return NextResponse.json(await new PersistentIdentifierService().list({
      ...parsed.data,
      actorId: actor.id,
      actorRole: actor.role,
    }));
  } catch (error) {
    return pidAdminError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminApi("admin:pids:manage", request);
    const parsed = createPersistentIdentifierSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Données d’identifiant invalides.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const created = await new PersistentIdentifierService().create({
      resourceType: parsed.data.resourceType,
      suffixType: parsed.data.suffixType,
      resourceId: parsed.data.resourceId,
      targetUrl: parsed.data.targetUrl,
      metadata: parsed.data.metadata,
      createdBy: actor.id,
    }, auditRequestContext(request));
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return pidAdminError(error);
  }
}
