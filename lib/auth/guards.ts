import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { can, isAdministrativeRole, type Permission } from "@/lib/auth/rbac";
import { hasActiveSubscription } from "@/lib/subscriptions/service";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, name: true, image: true, role: true, status: true } });
  if (!user || user.status !== "ACTIVE") redirect("/login?account=unavailable");
  return user;
}

export async function requireRole(allowedRoles: readonly Role[]) {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role)) redirect("/dashboard");
  return user;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, name: true, image: true, role: true, status: true } });
  if (!user || user.status !== "ACTIVE") redirect("/admin/login?account=unavailable");
  if (!isAdministrativeRole(user.role)) redirect("/admin/denied");
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireAdmin();
  if (!can(user.role, permission)) redirect("/admin/denied");
  return user;
}

export async function requireActiveSubscriber() {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN" || user.role === "GOVERNMENT") return user;
  if (!await hasActiveSubscription(user.id)) redirect("/pricing?required=1");
  return user;
}
