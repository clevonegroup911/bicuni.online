import { describe, expect, it, vi } from "vitest";

vi.mock("../db/client", () => ({ db: {} }));
vi.mock("../documents/review-service", () => ({ ReviewService: class {} }));

import { DOCUMENT_LIST_ORDER, formatFileSize } from "./document-admin-service";
import { canArchiveDocument, toDocumentResource } from "../documents/permissions";

describe("AdminDocumentService utilitaires", () => {
  it("définit un ordre de liste déterministe", () => {
    expect(DOCUMENT_LIST_ORDER).toEqual([{ updatedAt: "desc" }, { id: "desc" }]);
  });

  it("formate une taille réelle sans inventer de valeur", () => {
    expect(formatFileSize(512)).toBe("512 o");
    expect(formatFileSize(-1)).toBe("—");
  });

  it("calcule canArchive à partir d’un DocumentResource complet authorId + status", () => {
    const resource = toDocumentResource({ authorId: "author-1", status: "APPROVED" });
    expect(resource.authorId).toBe("author-1");
    expect(resource.status).toBe("APPROVED");
    expect(canArchiveDocument({ id: "root", role: "SUPER_ADMIN" }, resource)).toBe(true);
  });
});
