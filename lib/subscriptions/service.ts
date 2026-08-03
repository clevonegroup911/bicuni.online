import type { SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db/client";

const ACCESS_STATUSES: readonly SubscriptionStatus[] = ["ACTIVE"];

export async function getCurrentSubscription(userId: string) {
  return db.subscription.findFirst({
    where: {
      userId,
      status: { in: [...ACCESS_STATUSES] },
      OR: [
        { currentPeriodEnd: null },
        { currentPeriodEnd: { gt: new Date() } },
      ],
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function hasActiveSubscription(userId: string) {
  return Boolean(await getCurrentSubscription(userId));
}
