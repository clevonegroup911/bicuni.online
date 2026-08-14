import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const THIS_FILE = path.join(process.cwd(), "lib/pid/pg-concurrency.isolated.test.ts");
const HARNESS = path.join(process.cwd(), "scripts/pid-pg-concurrency-isolated.ts");
const WRAPPER = path.join(process.cwd(), "scripts/pid-pg-concurrency-isolated.sh");
const MIGRATION = path.join(
  process.cwd(),
  "prisma/migrations/20260813120000_persistent_identifiers/migration.sql",
);

/**
 * Ces tests statiques ne prouvent pas encore le comportement concurrent réel de PostgreSQL.
 * The live suite is scripts/pid-pg-concurrency-isolated.ts (throwaway initdb only).
 */
describe("harness concurrence PID (garde isolée)", () => {
  it("ne cible jamais la base applicative et n’exécute aucune migration Prisma", () => {
    const harness = readFileSync(HARNESS, "utf8");
    const wrapper = readFileSync(WRAPPER, "utf8");
    for (const source of [harness, wrapper]) {
      expect(source).not.toMatch(/process\.env\.DATABASE_URL/);
      expect(source).not.toMatch(/migrate deploy/);
      expect(source).not.toMatch(/migrate dev/);
    }
    expect(harness).toMatch(/listen_addresses=''/);
    expect(harness).toMatch(/initdb/);
    expect(harness).toMatch(/FOR KEY SHARE/);
    expect(wrapper).toMatch(/unset DATABASE_URL/);
  });

  it("POSTGRES CONCURRENCY TEST NOT EXECUTED depuis npm test (opt-in cluster jetable uniquement)", () => {
    const unit = readFileSync(THIS_FILE, "utf8");
    expect(unit).not.toMatch(/execFile(?:Async)?\(\s*["']initdb["']/);
    expect(unit).not.toMatch(/spawn\(\s*["']initdb["']/);
    expect(unit).not.toMatch(/execFile(?:Async)?\(\s*["']pg_ctl["']/);
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql).toMatch(/FOR KEY SHARE/);
    expect(sql).toMatch(/CREATE TRIGGER prevent_pid_bound_document_delete/);
    expect(sql).toMatch(/CREATE TRIGGER prevent_pid_bound_publication_delete/);
  });
});
