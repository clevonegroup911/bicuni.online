import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/observability/logger";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const createClient = () => {
  const client = new PrismaClient({ log: [{ emit: "event", level: "error" }] });
  client.$on("error", (event) => logger.error("prisma.error", new Error(event.message), { target: event.target }));
  return client;
};
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
