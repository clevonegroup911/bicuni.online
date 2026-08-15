import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { auditRequestContext } from "@/lib/admin/context";
import { can } from "@/lib/auth/rbac";
import { profileWriteFields } from "@/lib/profile/contract";

const profileSchema = z.object({
  name: profileWriteFields.name.optional(),
  bio: profileWriteFields.bio.optional(),
  title: profileWriteFields.title.optional(),
  country: profileWriteFields.country.optional(),
  orcid: profileWriteFields.orcid.optional(),
  website: profileWriteFields.website.optional(),
  image: profileWriteFields.image.optional(),
  researchFields: profileWriteFields.researchFields.optional(),
  universityId: profileWriteFields.universityId.optional(),
  departmentId: profileWriteFields.departmentId.optional(),
}).strict();

const selectProfile = {
  id: true, email: true, name: true, image: true,
  profile: { include: { university: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } } },
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: selectProfile });
  if (!user) return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  return NextResponse.json({ profile: user });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  if (!can(session.user.role, "profile:write")) return NextResponse.json({ error: "Permission profile:write requise." }, { status: 403 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Profil invalide.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });

  const { name, image, universityId, departmentId, ...profileFields } = parsed.data;
  if (departmentId && !universityId) {
    return NextResponse.json({ error: "Une institution est requise pour ce département." }, { status: 400 });
  }
  if (universityId) {
    const university = await db.university.findFirst({ where: { id: universityId, status: "ACTIVE" }, select: { id: true } });
    if (!university) return NextResponse.json({ error: "Institution invalide." }, { status: 400 });
  }
  if (departmentId) {
    const selectedUniversityId = universityId as string;
    const department = await db.department.findFirst({
      where: { id: departmentId, faculty: { universityId: selectedUniversityId } }, select: { id: true },
    });
    if (!department) return NextResponse.json({ error: "Le département n’appartient pas à cette institution." }, { status: 400 });
  }

  try {
    const user = await db.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: session.user.id },
        data: { ...(name !== undefined ? { name } : {}), ...(image !== undefined ? { image } : {}) },
      });
      await transaction.profile.upsert({
        where: { userId: session.user.id },
        create: { userId: session.user.id, universityId: universityId ?? null, departmentId: departmentId ?? null, ...profileFields },
        update: {
          ...(universityId !== undefined ? { universityId, departmentId: departmentId ?? null } : {}),
          ...(universityId === undefined && departmentId !== undefined ? { departmentId } : {}),
          ...profileFields,
        },
      });
      await transaction.auditLog.create({ data: { actorId: session.user.id, action: "PROFILE_UPDATE", entityType: "User", entityId: session.user.id, ...auditRequestContext(request) } });
      return transaction.user.findUniqueOrThrow({ where: { id: session.user.id }, select: selectProfile });
    });
    return NextResponse.json({ profile: user });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Cet ORCID est déjà utilisé.", fields: { orcid: "ORCID déjà utilisé." } }, { status: 409 });
    }
    throw error;
  }
}
