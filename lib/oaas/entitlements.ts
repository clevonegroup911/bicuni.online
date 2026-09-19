import type { OutcomeMissionStatus } from "@prisma/client";
import { db } from "@/lib/db/client";
import { hasActiveSubscription } from "@/lib/subscriptions/service";

const ACTIVE_MISSION_STATUSES: readonly OutcomeMissionStatus[] = [
  "AWAITING_PAYMENT",
  "PLANNED",
  "READY",
  "EXECUTING",
  "AWAITING_HUMAN_REVIEW",
  "VERIFYING",
  "DELIVERY_READY",
  "DELIVERED",
  "REVISION_REQUESTED",
];

/** Accès produit : abonnement legacy OU mission OaaS active. */
export async function hasProductAccess(userId: string) {
  if (await hasActiveSubscription(userId)) return true;
  const mission = await db.outcomeMission.findFirst({
    where: { ownerId: userId, status: { in: [...ACTIVE_MISSION_STATUSES] } },
    select: { id: true },
  });
  return Boolean(mission);
}

export async function listActiveMissions(userId: string) {
  return db.outcomeMission.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    include: {
      pack: true,
      tasks: { select: { status: true } },
      approvals: { where: { status: "PENDING" }, select: { id: true, title: true } },
    },
  });
}
