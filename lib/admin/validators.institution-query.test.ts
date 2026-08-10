import { describe, expect, it } from "vitest";
import {
  ADMIN_INSTITUTION_PAGE_MAX,
  parseAdminInstitutionQuery,
  resolveAdminInstitutionQuery,
} from "./validators";

describe("adminInstitutionQuerySchema / parseAdminInstitutionQuery", () => {
  it("accepte une page entière positive", () => {
    expect(parseAdminInstitutionQuery({ page: "2" }).success).toBe(true);
    expect(parseAdminInstitutionQuery({ page: "2" }).data?.page).toBe(2);
  });

  it("rejette page=1.5", () => {
    expect(parseAdminInstitutionQuery({ page: "1.5" }).success).toBe(false);
  });

  it("rejette page=Infinity", () => {
    expect(parseAdminInstitutionQuery({ page: "Infinity" }).success).toBe(false);
  });

  it("rejette page=-1", () => {
    expect(parseAdminInstitutionQuery({ page: "-1" }).success).toBe(false);
  });

  it("rejette une page extrêmement élevée", () => {
    expect(parseAdminInstitutionQuery({ page: String(ADMIN_INSTITUTION_PAGE_MAX + 1) }).success).toBe(false);
    expect(parseAdminInstitutionQuery({ page: "999999999" }).success).toBe(false);
  });

  it("rejette q trop long", () => {
    expect(parseAdminInstitutionQuery({ q: "x".repeat(121) }).success).toBe(false);
  });

  it("rejette country trop long", () => {
    expect(parseAdminInstitutionQuery({ country: "c".repeat(81) }).success).toBe(false);
  });

  it("normalise explicitement les paramètres invalides via resolveAdminInstitutionQuery", () => {
    const resolved = resolveAdminInstitutionQuery({ page: "1.5", q: "x".repeat(200), country: "c".repeat(100) });
    expect(resolved.ok).toBe(false);
    expect(resolved.data).toEqual({ q: "", page: 1 });
  });
});
