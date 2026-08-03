export const ROLES = ["STUDENT", "RESEARCHER", "UNIVERSITY_ADMIN", "SUPER_ADMIN", "GOVERNMENT"] as const;
export type AppRole = typeof ROLES[number];
const grants: Record<AppRole, readonly string[]> = {
  STUDENT: ["document:read", "profile:write"],
  RESEARCHER: ["document:read", "document:create", "profile:write", "analytics:own"],
  UNIVERSITY_ADMIN: ["document:read", "document:create", "document:review", "university:manage"],
  SUPER_ADMIN: ["*"],
  GOVERNMENT: ["document:read", "analytics:national"]
};
export function can(role: AppRole, permission: string) { return grants[role].includes("*") || grants[role].includes(permission); }
