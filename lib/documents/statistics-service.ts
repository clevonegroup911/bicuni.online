import { db } from "@/lib/db/client";

export class StatisticsService {
  async recordView(documentId: string) { return db.document.update({ where: { id: documentId }, data: { viewCount: { increment: 1 } }, select: { viewCount: true } }); }
  async toggleFavorite(documentId: string, userId: string) {
    const existing = await db.documentFavorite.findUnique({ where: { userId_documentId: { userId, documentId } } });
    return db.$transaction(async (tx) => {
      if (existing) { await tx.documentFavorite.delete({ where: { userId_documentId: { userId, documentId } } }); await tx.document.update({ where: { id: documentId }, data: { favoriteCount: { decrement: 1 } } }); return false; }
      await tx.documentFavorite.create({ data: { userId, documentId } }); await tx.document.update({ where: { id: documentId }, data: { favoriteCount: { increment: 1 } } }); return true;
    });
  }
}
