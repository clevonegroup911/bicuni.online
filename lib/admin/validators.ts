import { Role, UserStatus } from "@prisma/client";
import { z } from "zod";

export const adminUserQuerySchema = z.object({
  q: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).default(1),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export const createAdminSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
  role: z.enum(["ADMIN", "MODERATOR", "INSTITUTION_ADMIN", "SUPER_ADMIN"]),
});

export const updateAdminUserSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("role"), role: z.nativeEnum(Role) }),
  z.object({ action: z.literal("status"), status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]) }),
]);
