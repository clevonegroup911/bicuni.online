import { DashboardShell } from "@/components/dashboard-shell";
import { requireActiveSubscriber } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { getCurrentSubscription } from "@/lib/subscriptions/service";

export default async function Dashboard() {
  const user = await requireActiveSubscriber();
  const [documentCount, publishedCount, pendingCount, draftCount, favoriteCount, recent, aggregate, subscription] = await Promise.all([
    db.document.count({ where: { authorId: user.id, status: { not: "DELETED" } } }),
    db.document.count({ where: { authorId: user.id, status: { in: ["APPROVED", "PUBLISHED"] } } }),
    db.document.count({ where: { authorId: user.id, status: "PENDING_REVIEW" } }),
    db.document.count({ where: { authorId: user.id, status: "DRAFT" } }),
    db.documentFavorite.count({ where: { userId: user.id } }),
    db.document.findMany({
      where: { authorId: user.id, status: { not: "DELETED" } },
      select: { id: true, title: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    db.document.aggregate({
      where: { authorId: user.id },
      _sum: { viewCount: true, downloadCount: true, favoriteCount: true },
    }),
    getCurrentSubscription(user.id),
  ]);
  const secondaryCount = (aggregate._sum.viewCount ?? 0) + (aggregate._sum.downloadCount ?? 0) + (aggregate._sum.favoriteCount ?? 0);
  return (
    <DashboardShell
      data={{
        documentCount,
        publishedCount,
        pendingCount,
        draftCount,
        favoriteCount,
        secondaryCount,
        subscriptionName: subscription?.plan.name ?? null,
        recent,
      }}
    />
  );
}
