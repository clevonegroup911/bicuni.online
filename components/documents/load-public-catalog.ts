import type { DocumentType } from "@prisma/client";
import { db } from "@/lib/db/client";
import { DocumentService } from "@/lib/documents/document-service";
import { logger } from "@/lib/observability/logger";

type ListInput = {
  page: number;
  pageSize: number;
  query?: string;
  category?: string;
  type?: DocumentType;
  university?: string;
  sort?: "recent" | "views";
};

export async function loadPublicCatalog(input: ListInput) {
  try {
    return { unavailable: false as const, result: await new DocumentService().listPublic(input) };
  } catch (error) {
    logger.error("public.catalog.unavailable", error);
    return {
      unavailable: true as const,
      result: { items: [], total: 0, page: input.page, pageSize: input.pageSize },
    };
  }
}

export async function loadCatalogFacets() {
  try {
    const [categories, universities] = await Promise.all([
      db.category.findMany({
        where: { documents: { some: { status: { in: ["APPROVED", "PUBLISHED"] }, deletedAt: null } } },
        select: { name: true },
        orderBy: { name: "asc" },
      }),
      db.university.findMany({
        where: { documents: { some: { status: { in: ["APPROVED", "PUBLISHED"] }, deletedAt: null } } },
        select: { name: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return {
      categories: categories.map((item) => item.name),
      universities: universities.map((item) => item.name),
    };
  } catch (error) {
    logger.error("public.catalog.facets.unavailable", error);
    return { categories: [] as string[], universities: [] as string[] };
  }
}
