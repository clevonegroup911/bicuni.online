import { describe, expect, it } from "vitest";
import {
  ADMIN_DOCUMENT_PAGE_MAX,
  ADMIN_DOCUMENT_PAGE_SIZE_MAX,
  parseAdminDocumentQuery,
  resolveAdminDocumentQuery,
  updateAdminDocumentSchema,
} from "./validators";

describe("adminDocumentQuerySchema", () => {
  it("accepte une page entière positive", () => {
    expect(parseAdminDocumentQuery({ page: "2" }).success).toBe(true);
    expect(parseAdminDocumentQuery({ page: "2" }).data?.page).toBe(2);
  });

  it("rejette page=1.5", () => {
    expect(parseAdminDocumentQuery({ page: "1.5" }).success).toBe(false);
  });

  it("rejette page=Infinity", () => {
    expect(parseAdminDocumentQuery({ page: "Infinity" }).success).toBe(false);
  });

  it("rejette page=-1 et page=0", () => {
    expect(parseAdminDocumentQuery({ page: "-1" }).success).toBe(false);
    expect(parseAdminDocumentQuery({ page: "0" }).success).toBe(false);
  });

  it("rejette une page extrêmement élevée", () => {
    expect(parseAdminDocumentQuery({ page: String(ADMIN_DOCUMENT_PAGE_MAX + 1) }).success).toBe(false);
  });

  it("borne la limite", () => {
    expect(parseAdminDocumentQuery({ limit: "25" }).success).toBe(true);
    expect(parseAdminDocumentQuery({ limit: String(ADMIN_DOCUMENT_PAGE_SIZE_MAX + 1) }).success).toBe(false);
    expect(parseAdminDocumentQuery({ limit: "0" }).success).toBe(false);
  });

  it("rejette q trop long", () => {
    expect(parseAdminDocumentQuery({ q: "x".repeat(121) }).success).toBe(false);
  });

  it("rejette un statut DELETED ou inconnu", () => {
    expect(parseAdminDocumentQuery({ status: "DELETED" }).success).toBe(false);
    expect(parseAdminDocumentQuery({ status: "nope" }).success).toBe(false);
  });

  it("rejette un type invalide", () => {
    expect(parseAdminDocumentQuery({ type: "PDF" }).success).toBe(false);
  });

  it("rejette un institutionId non cuid", () => {
    expect(parseAdminDocumentQuery({ institutionId: "uni-1" }).success).toBe(false);
  });

  it("normalise les paramètres invalides via resolveAdminDocumentQuery", () => {
    const resolved = resolveAdminDocumentQuery({ page: "1.5", q: "x".repeat(200), limit: "999" });
    expect(resolved.ok).toBe(false);
    expect(resolved.data.page).toBe(1);
    expect(resolved.data.q).toBe("");
    expect(resolved.data.limit).toBe(25);
  });
});

describe("dates de filtre strictes", () => {
  it("accepte une vraie date calendrier", () => {
    expect(parseAdminDocumentQuery({ from: "2026-01-15" }).success).toBe(true);
    expect(parseAdminDocumentQuery({ from: "2026-01-15" }).data?.from).toBe("2026-01-15");
  });

  it("refuse 2026-99-99", () => {
    expect(parseAdminDocumentQuery({ from: "2026-99-99" }).success).toBe(false);
  });

  it("refuse 2026-02-30", () => {
    expect(parseAdminDocumentQuery({ from: "2026-02-30" }).success).toBe(false);
  });

  it("refuse 2026-13-01", () => {
    expect(parseAdminDocumentQuery({ from: "2026-13-01" }).success).toBe(false);
  });

  it("refuse from > to", () => {
    expect(parseAdminDocumentQuery({ from: "2026-03-02", to: "2026-03-01" }).success).toBe(false);
  });

  it("accepte from == to", () => {
    const parsed = parseAdminDocumentQuery({ from: "2026-03-01", to: "2026-03-01" });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.from).toBe("2026-03-01");
    expect(parsed.data?.to).toBe("2026-03-01");
  });
});

describe("updateAdminDocumentSchema", () => {
  it("refuse un rejet sans motif suffisant", () => {
    expect(updateAdminDocumentSchema.safeParse({ action: "review", review: { decision: "REJECTED" } }).success).toBe(false);
    expect(updateAdminDocumentSchema.safeParse({ action: "review", review: { decision: "REJECTED", comment: "court" } }).success).toBe(false);
  });

  it("accepte une approbation et un archivage", () => {
    expect(updateAdminDocumentSchema.safeParse({ action: "review", review: { decision: "APPROVED" } }).success).toBe(true);
    expect(updateAdminDocumentSchema.safeParse({ action: "archive" }).success).toBe(true);
  });

  it("refuse une suppression physique", () => {
    expect(updateAdminDocumentSchema.safeParse({ action: "delete" }).success).toBe(false);
  });
});
