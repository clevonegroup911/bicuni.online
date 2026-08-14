import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "prisma/migrations/20260813120000_persistent_identifiers/migration.sql"),
  "utf8",
);

describe("immutabilité PostgreSQL PID", () => {
  it("protège les champs identitaires et interdit le DELETE physique", () => {
    expect(sql).toMatch(/CREATE TRIGGER persistent_identifier_identity_immutable/i);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OR DELETE ON "PersistentIdentifier"/);
    expect(sql).toMatch(/TG_OP = 'INSERT'/);
    expect(sql).toMatch(/NEW\."identifier" IS DISTINCT FROM OLD\."identifier"/);
    expect(sql).toMatch(/NEW\."scheme" IS DISTINCT FROM OLD\."scheme"/);
    expect(sql).toMatch(/NEW\."prefix" IS DISTINCT FROM OLD\."prefix"/);
    expect(sql).toMatch(/NEW\."suffix" IS DISTINCT FROM OLD\."suffix"/);
    expect(sql).toMatch(/NEW\."resourceType" IS DISTINCT FROM OLD\."resourceType"/);
    expect(sql).toMatch(/NEW\."resourceId" IS DISTINCT FROM OLD\."resourceId"/);
    expect(sql).toMatch(/NEW\."createdAt" IS DISTINCT FROM OLD\."createdAt"/);
    expect(sql).toMatch(/PersistentIdentifier cannot be physically deleted/);
    expect(sql).toMatch(/TOMBSTONE is a terminal PersistentIdentifier status/);
  });

  it("refuse un INSERT DOI / préfixe 10.x / identifiant incohérent (tests SQL statiques)", () => {
    expect(sql).toMatch(/CONSTRAINT "PersistentIdentifier_scheme_bicuni_check" CHECK \("scheme" = 'BICUNI_PID'\)/);
    expect(sql).toMatch(/CONSTRAINT "PersistentIdentifier_prefix_bcu_check" CHECK \("prefix" = 'bcu'\)/);
    expect(sql).toMatch(/CONSTRAINT "PersistentIdentifier_identifier_matches_check" CHECK \("identifier" = "prefix" \|\| '\/' \|\| "suffix"\)/);
    expect(sql).toMatch(/CONSTRAINT "PersistentIdentifier_no_doi_prefix_check"/);
    expect(sql).toMatch(/CREATE TYPE "PersistentIdentifierScheme" AS ENUM \('BICUNI_PID'\)/);
    expect(sql).not.toMatch(/ENUM \('BICUNI_PID', 'DOI'\)/);
    expect(sql).toMatch(/CREATE TYPE "PidResourceType" AS ENUM \('DOCUMENT', 'PUBLICATION'\)/);
    expect(sql).toMatch(/NEW\."scheme" IS DISTINCT FROM 'BICUNI_PID'/);
    expect(sql).toMatch(/NEW\."prefix" LIKE '10\.%'/);
    expect(sql).toMatch(/10\.bcu/);
    expect(sql).toMatch(/10\.87878\/bicuni/);
  });

  it("conserve l’historique en RESTRICT et reste additive", () => {
    expect(sql).toMatch(/PersistentIdentifierTargetHistory_persistentIdentifierId_fkey[\s\S]*ON DELETE RESTRICT/);
    expect(sql).not.toMatch(/ON DELETE CASCADE/);
    expect(sql).not.toMatch(/^\s*DROP /m);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
  });

  it("préserve les unicités métier et refuse un PID orphelin", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX "PersistentIdentifier_identifier_key"/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "PersistentIdentifier_prefix_suffix_key"/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "PersistentIdentifier_resourceType_resourceId_key"/);
    expect(sql).toMatch(/"resourceId" TEXT NOT NULL/);
    expect(sql).toMatch(/CONSTRAINT "PersistentIdentifier_resource_id_present_check"/);
    expect(sql).toMatch(/CREATE TRIGGER persistent_identifier_resource_bound/);
    expect(sql).toMatch(/BEFORE INSERT ON "PersistentIdentifier"/);
    expect(sql).toMatch(/PersistentIdentifier resourceId is required/);
    expect(sql).toMatch(/FROM "Document"\s+WHERE "id" = NEW\."resourceId"/);
    expect(sql).toMatch(/FROM "Publication"\s+WHERE "id" = NEW\."resourceId"/);
    expect(sql).toMatch(/PersistentIdentifier DOCUMENT resource does not exist/);
    expect(sql).toMatch(/PersistentIdentifier PUBLICATION resource does not exist/);
    expect(sql).not.toMatch(/INSERT INTO "Document"/);
    expect(sql).not.toMatch(/INSERT INTO "Publication"/);
  });

  /**
   * Ces tests statiques ne prouvent pas encore le comportement concurrent réel de PostgreSQL.
   */
  it("verrouille Document et Publication avec FOR KEY SHARE à l’INSERT PID", () => {
    expect(sql).toMatch(
      /PERFORM 1\s+FROM "Document"\s+WHERE "id" = NEW\."resourceId"\s+FOR KEY SHARE/s,
    );
    expect(sql).toMatch(
      /PERFORM 1\s+FROM "Publication"\s+WHERE "id" = NEW\."resourceId"\s+FOR KEY SHARE/s,
    );
    expect(sql).toMatch(/FOR KEY SHARE;\s*IF NOT FOUND THEN/s);
    expect(sql).toMatch(/CREATE TRIGGER persistent_identifier_resource_bound/);
    expect(sql).toMatch(/BEFORE INSERT ON "PersistentIdentifier"/);
    expect(sql).toMatch(/EXECUTE PROCEDURE prevent_persistent_identifier_orphan\(\)/);
    expect(sql).not.toMatch(/IF NOT EXISTS \(SELECT 1 FROM "Document"/);
    expect(sql).not.toMatch(/IF NOT EXISTS \(SELECT 1 FROM "Publication"/);
    expect(sql).not.toMatch(/^\s*LOCK TABLE\b/im);
    expect(sql).not.toMatch(/pg_advisory_lock/i);
    expect(sql).not.toMatch(/pg_advisory_xact_lock/i);
    expect([...sql.matchAll(/FOR KEY SHARE;/g)]).toHaveLength(2);
  });

  it("empêche le DELETE physique d’un Document ou d’une Publication liés à un PID", () => {
    expect(sql).toMatch(/CREATE TRIGGER prevent_pid_bound_document_delete/);
    expect(sql).toMatch(/BEFORE DELETE ON "Document"/);
    expect(sql).toMatch(/CREATE TRIGGER prevent_pid_bound_publication_delete/);
    expect(sql).toMatch(/BEFORE DELETE ON "Publication"/);
    expect(sql).toMatch(/p\."resourceType" = 'DOCUMENT'::"PidResourceType"/);
    expect(sql).toMatch(/p\."resourceType" = 'PUBLICATION'::"PidResourceType"/);
    expect(sql).toMatch(/p\."resourceId" = OLD\.id/);
    expect(sql).toMatch(/Cannot physically delete a resource referenced by a persistent identifier/);
    expect(sql).not.toMatch(/DELETE FROM "PersistentIdentifier"/i);
    expect(sql).not.toMatch(/DELETE FROM "Document"/i);
    expect(sql).not.toMatch(/DELETE FROM "Publication"/i);
    expect(sql).not.toMatch(/ON DELETE CASCADE/);
    expect(sql).not.toMatch(/^\s*DROP /m);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE FROM\b/i);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OR DELETE ON "PersistentIdentifier"/);
    expect(sql).toMatch(/PersistentIdentifier cannot be physically deleted/);
    expect(sql).toMatch(/TOMBSTONE is a terminal PersistentIdentifier status/);
    expect(sql).toMatch(/PersistentIdentifierTargetHistory_persistentIdentifierId_fkey[\s\S]*ON DELETE RESTRICT/);
  });
});
