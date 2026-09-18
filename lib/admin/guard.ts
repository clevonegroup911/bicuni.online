import { auth } from "../../auth";
import { db } from "../db/client";
import { can, type Permission } from "../auth/rbac";
import { assertSameOrigin } from "@/lib/payments/clevone/http";
import { ClevonePaymentError } from "@/lib/payments/clevone/types";

export class AdminAuthorizationError extends Error {
  constructor(message: string, readonly status: 401 | 403 = 403) { super(message); }
}

function assertAdminOrigin(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof ClevonePaymentError) {
      throw new AdminAuthorizationError("Origine de requête administrative invalide.", 403);
    }
    throw error;
  }
}

export async function requireAdminApi(permission: Permission, request?: Request) {
  if (request) assertAdminOrigin(request);
  const session = await auth();
  if (!session?.user?.id) throw new AdminAuthorizationError("Authentification administrative requise.", 401);
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, status: true, mfaEnabled: true, mfaSecretEnc: true, mfaLastVerifiedAt: true, mfaLockedUntil: true, mfaFailedAttempts: true },
  });
  if (!user || user.status !== "ACTIVE") throw new AdminAuthorizationError("Compte administratif indisponible.", 403);
  if (!can(user.role, permission)) throw new AdminAuthorizationError("Permission administrative insuffisante.", 403);
  return user;
}
