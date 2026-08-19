import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role, UserStatus } from "@prisma/client";
import { compare } from "bcryptjs";
import { createHash } from "node:crypto";
import { db } from "@/lib/db/client";
import { auditRequestContext } from "@/lib/admin/context";
import { consumeAuthAttempt, RateLimitUnavailableError, requestIdentity } from "@/lib/auth/rate-limit";
import { credentialsSchema } from "@/lib/auth/validators";
import { logger } from "@/lib/observability/logger";

function isRole(value: unknown): value is Role {
  return Object.values(Role).some((role) => role === value);
}

function isUserStatus(value: unknown): value is UserStatus {
  return Object.values(UserStatus).some((status) => status === value);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      authorize: async (rawCredentials, request) => {
        try {
          const parsed = credentialsSchema.safeParse(rawCredentials);
          if (!parsed.success) return null;
          const emailHash = createHash("sha256").update(parsed.data.email).digest("hex");
          if (!await consumeAuthAttempt(`credentials:${requestIdentity(request)}:${emailHash}`, 8)) return null;
          const user = await db.user.findUnique({ where: { email: parsed.data.email } });
          if (!user?.passwordHash || !user.emailVerified || user.status !== "ACTIVE") {
            await db.auditLog.create({ data: { actorId: user?.id, action: "AUTH_SIGN_IN_FAILED", entityType: "User", entityId: user?.id, ...auditRequestContext(request) } });
            return null;
          }
          const validPassword = await compare(parsed.data.password, user.passwordHash);
          if (!validPassword) {
            await db.auditLog.create({ data: { actorId: user.id, action: "AUTH_SIGN_IN_FAILED", entityType: "User", entityId: user.id, ...auditRequestContext(request) } });
            return null;
          }
          return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role, status: user.status };
        } catch (error) {
          if (error instanceof RateLimitUnavailableError) return null;
          logger.error("auth.credentials.error", error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
        return token;
      }
      if (typeof token.id !== "string") return token;
      // Keep role/status aligned with PostgreSQL so suspensions and role changes apply immediately,
      // and so JWTs issued before UserStatus existed remain valid after migration.
      const fresh = await db.user.findUnique({
        where: { id: token.id },
        select: {
          role: true,
          status: true,
          passwordResetTokens: {
            where: { usedAt: { not: null } },
            select: { usedAt: true },
            orderBy: { usedAt: "desc" },
            take: 1,
          },
        },
      });
      if (!fresh || fresh.status !== "ACTIVE") {
        return {};
      }
      const passwordResetAt = fresh.passwordResetTokens[0]?.usedAt;
      if (passwordResetAt && typeof token.iat === "number" && token.iat * 1000 < passwordResetAt.getTime()) {
        return {};
      }
      token.role = fresh.role;
      token.status = fresh.status;
      return token;
    },
    session({ session, token }) {
      if (typeof token.id !== "string" || !isRole(token.role) || !isUserStatus(token.status) || token.status !== "ACTIVE") {
        // Treat suspended/invalid JWTs as logged out instead of throwing 500s.
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.status = token.status;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await db.$transaction([
        db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
        db.auditLog.create({ data: { actorId: user.id, action: "AUTH_SIGN_IN", entityType: "User", entityId: user.id } }),
      ]);
    },
    async signOut(message) {
      const actorId = "token" in message ? message.token?.id : message.session?.userId;
      await db.auditLog.create({
        data: {
          actorId: typeof actorId === "string" ? actorId : null,
          action: "AUTH_SIGN_OUT",
          entityType: "User",
          entityId: typeof actorId === "string" ? actorId : null,
        },
      });
    },
  },
});
