import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { db } from "@/lib/db/client";
import { credentialsSchema } from "@/lib/auth/validators";
import { logger } from "@/lib/observability/logger";

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
      authorize: async (rawCredentials) => {
        try {
          const parsed = credentialsSchema.safeParse(rawCredentials);
          if (!parsed.success) return null;
          const user = await db.user.findUnique({ where: { email: parsed.data.email } });
          if (!user?.passwordHash || !user.emailVerified) return null;
          const validPassword = await compare(parsed.data.password, user.passwordHash);
          if (!validPassword) return null;
          return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role };
        } catch (error) {
          logger.error("auth.credentials.error", error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await db.auditLog.create({
        data: {
          actorId: user.id,
          action: "AUTH_SIGN_IN",
          entityType: "User",
          entityId: user.id,
        },
      });
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
