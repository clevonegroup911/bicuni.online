import { hash } from "bcryptjs";
import { db } from "../db/client";
import { createAdminSchema } from "./validators";

export class SuperAdminBootstrapError extends Error {}

export async function initializeSuperAdmin(input: { email: string; name: string; password: string }) {
  const parsed = createAdminSchema.safeParse({ ...input, role: "SUPER_ADMIN" });
  if (!parsed.success) throw new SuperAdminBootstrapError("Variables SUPER_ADMIN invalides. Utilisez un email valide et un mot de passe robuste d’au moins 12 caractères.");
  const existing = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, role: true, status: true } });
  if (existing) {
    if (existing.role !== "SUPER_ADMIN") throw new SuperAdminBootstrapError("L’adresse SUPER_ADMIN_EMAIL appartient déjà à un compte non administrateur.");
    if (existing.status !== "ACTIVE") throw new SuperAdminBootstrapError("Le compte SUPER_ADMIN existe mais n’est pas actif.");
    return { created: false, id: existing.id };
  }
  if (await db.user.count({ where: { role: "SUPER_ADMIN", status: { not: "DELETED" } } }) > 0) throw new SuperAdminBootstrapError("Un SUPER_ADMIN existe déjà. Utilisez le Back Office pour créer un administrateur supplémentaire.");
  const passwordHash = await hash(parsed.data.password, 12);
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { email: parsed.data.email, name: parsed.data.name, passwordHash, role: "SUPER_ADMIN", status: "ACTIVE", emailVerified: new Date(), profile: { create: {} } }, select: { id: true } });
    await tx.auditLog.create({ data: { actorId: created.id, action: "SUPER_ADMIN_INITIALIZED", entityType: "User", entityId: created.id, newValue: { role: "SUPER_ADMIN", status: "ACTIVE" } } });
    return created;
  });
  return { created: true, id: user.id };
}
