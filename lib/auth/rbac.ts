import type { Role } from "@prisma/client";

export const ROLES = ["USER", "ADMIN", "MODERATOR", "INSTITUTION_ADMIN", "STUDENT", "RESEARCHER", "UNIVERSITY_ADMIN", "SUPER_ADMIN", "GOVERNMENT"] as const satisfies readonly Role[];
export const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "INSTITUTION_ADMIN", "UNIVERSITY_ADMIN"] as const satisfies readonly Role[];
export type Permission = "admin:access" | "admin:users:read" | "admin:users:manage" | "admin:documents:review" | "admin:audit:read" | "document:read" | "document:create" | "profile:write" | "analytics:own" | "analytics:national" | "university:manage";

const grants: Record<Role, readonly (Permission | "*")[]> = {
  USER: ["document:read", "document:create", "profile:write"],
  ADMIN: ["admin:access", "admin:users:read", "admin:documents:review", "admin:audit:read", "document:read"],
  MODERATOR: ["admin:access", "admin:documents:review", "document:read"],
  INSTITUTION_ADMIN: ["admin:access", "admin:users:read", "admin:documents:review", "document:read", "document:create", "university:manage"],
  STUDENT: ["document:read", "document:create", "profile:write"],
  RESEARCHER: ["document:read", "document:create", "profile:write", "analytics:own"],
  UNIVERSITY_ADMIN: ["admin:access", "admin:users:read", "admin:documents:review", "document:read", "document:create", "university:manage"],
  SUPER_ADMIN: ["*"],
  GOVERNMENT: ["document:read", "analytics:national"],
};

export function can(role: Role, permission: Permission) {
  return grants[role].includes("*") || grants[role].includes(permission);
}

export function isAdministrativeRole(role: Role) {
  return ADMIN_ROLES.some((adminRole) => adminRole === role);
}

export function isSuperAdmin(role: Role) {
  return role === "SUPER_ADMIN";
}
