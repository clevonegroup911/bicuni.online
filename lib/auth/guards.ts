import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasActiveSubscription } from "@/lib/subscriptions/service";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
}

export async function requireRole(allowedRoles: readonly Role[]) {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role)) redirect("/dashboard");
  return user;
}

export async function requireActiveSubscriber() {
  const user = await requireUser();
  if (user.role === "SUPER_ADMIN" || user.role === "GOVERNMENT") return user;
  if (!await hasActiveSubscription(user.id)) redirect("/pricing?required=1");
  return user;
}
