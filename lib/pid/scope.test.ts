import { describe, expect, it } from "vitest";
import { encodePidHistoryCursor, parsePidHistoryCursor, pidInstitutionalExistsSql, prismaSqlText, scopedPidWhereSql } from "./scope";

describe("curseur d’historique PID", () => {
  it("encode et décode un curseur stable", () => {
    const entry = { changedAt: new Date("2026-08-13T10:00:00.000Z"), id: "hist-1" };
    const cursor = encodePidHistoryCursor(entry);
    expect(parsePidHistoryCursor(cursor)).toEqual(entry);
  });

  it("rejette un curseur invalide", () => {
    expect(parsePidHistoryCursor("not-a-cursor")).toBeNull();
    expect(parsePidHistoryCursor(undefined)).toBeNull();
  });
});

describe("scope SQL institutionnel", () => {
  it("filtre par EXISTS corrélé sans liste de resourceId", () => {
    const sql = prismaSqlText(pidInstitutionalExistsSql(["uni-a"]));
    expect(sql).toMatch(/EXISTS/);
    expect(sql).toMatch(/"Document"/);
    expect(sql).toMatch(/universityId/);
    expect(sql).not.toMatch(/resourceId IN/i);
  });

  it("compose le WHERE scoped sans matérialiser les documents", () => {
    const sql = prismaSqlText(scopedPidWhereSql(["uni-a"], { status: "ACTIVE" }));
    expect(sql).toMatch(/WHERE/);
    expect(sql).toMatch(/EXISTS/);
    expect(sql).toMatch(/ACTIVE/);
  });
});
