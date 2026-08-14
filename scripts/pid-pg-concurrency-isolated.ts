/**
 * Isolated PostgreSQL concurrency harness for BICUNI PID resource locks.
 * Throwaway initdb cluster only. Never the application database. Never Prisma migrate.
 */
import { spawn, execFile, type ChildProcessWithoutNullStreams } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const MIGRATION = path.join(
  process.cwd(),
  "prisma/migrations/20260813120000_persistent_identifiers/migration.sql",
);
const PG_USER = "pid_concurrency";
const PG_DATABASE = "pid_concurrency_test";
const DELETE_BLOCKED = "Cannot physically delete a resource referenced by a persistent identifier";
const FIXTURE_TARGET = "https://bicuni.online/internal-pid-concurrency-fixture";

type ResourceType = "DOCUMENT" | "PUBLICATION";
type PidSpec = { id: string; suffix: string };
type FixtureIds = {
  documentId: string;
  publicationId: string;
  documentPid: PidSpec;
  publicationPid: PidSpec;
};
type Sessions = { A: PsqlSession; B: PsqlSession; control: PsqlSession };

async function main(): Promise<void> {
  const cluster = await startThrowawayPostgres();
  try {
    const migrationSql = await readFile(MIGRATION, "utf8");
    const schemaSql = isolatedSchemaSql(migrationSql);
    if (!schemaSql.includes("FOR KEY SHARE")) {
      throw new Error("applied schema is missing FOR KEY SHARE");
    }
    await cluster.apply(schemaSql);
    await test("TEST 1 INSERT PID DOCUMENT then DELETE Document", () => test1(cluster));
    await test("TEST 2 DELETE Document then INSERT PID DOCUMENT", () => test2(cluster));
    await test("TEST 3 PUBLICATION both lock orders", () => test3(cluster));
    await test("TEST 4 CASCADE parent DELETE with PUBLICATION PID", () => test4(cluster));
    await test("TEST 5 concurrent CASCADE parent DELETE vs INSERT PID PUBLICATION", () => test5(cluster));
    process.stdout.write("ALL PID CONCURRENCY TESTS PASSED\n");
  } finally {
    await cluster.stop();
  }
}

async function test1(cluster: ThrowawayCluster): Promise<void> {
  const ids = idsFor("t1");
  await withSessions(cluster, async ({ A, B, control }) => {
    await control.query(`INSERT INTO "Document" ("id") VALUES ('${ids.documentId}')`);
    await pidFirstThenDelete({
      A,
      B,
      control,
      resourceType: "DOCUMENT",
      resourceId: ids.documentId,
      pid: ids.documentPid,
      deleteSql: `DELETE FROM "Document" WHERE "id" = '${ids.documentId}'`,
      blockedError: DELETE_BLOCKED,
    });
    assert.equal(await exists(control, "Document", ids.documentId), true);
    assert.equal(await pidExists(control, ids.documentPid.id), true);
  });
}

async function test2(cluster: ThrowawayCluster): Promise<void> {
  const ids = idsFor("t2");
  await withSessions(cluster, async ({ A, B, control }) => {
    await control.query(`INSERT INTO "Document" ("id") VALUES ('${ids.documentId}')`);
    await deleteFirstThenPid({
      A,
      B,
      control,
      resourceType: "DOCUMENT",
      resourceId: ids.documentId,
      pid: ids.documentPid,
      deleteSql: `DELETE FROM "Document" WHERE "id" = '${ids.documentId}'`,
      insertError: "PersistentIdentifier DOCUMENT resource does not exist",
    });
    assert.equal(await exists(control, "Document", ids.documentId), false);
    assert.equal(await pidExists(control, ids.documentPid.id), false);
  });
}

async function test3(cluster: ThrowawayCluster): Promise<void> {
  const first = idsFor("t3a");
  const second = idsFor("t3b");
  await withSessions(cluster, async ({ A, B, control }) => {
    await insertDocumentPublication(control, first);
    await pidFirstThenDelete({
      A,
      B,
      control,
      resourceType: "PUBLICATION",
      resourceId: first.publicationId,
      pid: first.publicationPid,
      deleteSql: `DELETE FROM "Publication" WHERE "id" = '${first.publicationId}'`,
      blockedError: DELETE_BLOCKED,
    });
    assert.equal(await exists(control, "Publication", first.publicationId), true);
    assert.equal(await pidExists(control, first.publicationPid.id), true);

    await insertDocumentPublication(control, second);
    await deleteFirstThenPid({
      A,
      B,
      control,
      resourceType: "PUBLICATION",
      resourceId: second.publicationId,
      pid: second.publicationPid,
      deleteSql: `DELETE FROM "Publication" WHERE "id" = '${second.publicationId}'`,
      insertError: "PersistentIdentifier PUBLICATION resource does not exist",
    });
    assert.equal(await exists(control, "Publication", second.publicationId), false);
    assert.equal(await pidExists(control, second.publicationPid.id), false);
    assert.equal(await exists(control, "Document", second.documentId), true);
  });
}

async function test4(cluster: ThrowawayCluster): Promise<void> {
  const ids = idsFor("t4");
  await withSessions(cluster, async ({ control }) => {
    await insertDocumentPublication(control, ids);
    const inserted = await control.query(
      insertPidSql({
        ...ids.publicationPid,
        resourceType: "PUBLICATION",
        resourceId: ids.publicationId,
      }),
    );
    assert.equal(inserted.stderr, "");
    const deleted = await control.query(`DELETE FROM "Document" WHERE "id" = '${ids.documentId}'`);
    assertSqlException(deleted.stderr, DELETE_BLOCKED, ids.documentId);
    assert.equal(await exists(control, "Document", ids.documentId), true);
    assert.equal(await exists(control, "Publication", ids.publicationId), true);
    assert.equal(await pidExists(control, ids.publicationPid.id), true);
  });
}

async function test5(cluster: ThrowawayCluster): Promise<void> {
  const pidFirst = idsFor("t5a");
  const deleteFirst = idsFor("t5b");
  await withSessions(cluster, async ({ A, B, control }) => {
    await insertDocumentPublication(control, pidFirst);
    await pidFirstThenDelete({
      A,
      B,
      control,
      resourceType: "PUBLICATION",
      resourceId: pidFirst.publicationId,
      pid: pidFirst.publicationPid,
      deleteSql: `DELETE FROM "Document" WHERE "id" = '${pidFirst.documentId}'`,
      blockedError: DELETE_BLOCKED,
    });
    assert.equal(await exists(control, "Document", pidFirst.documentId), true);
    assert.equal(await exists(control, "Publication", pidFirst.publicationId), true);
    assert.equal(await pidExists(control, pidFirst.publicationPid.id), true);

    await insertDocumentPublication(control, deleteFirst);
    await deleteFirstThenPid({
      A,
      B,
      control,
      resourceType: "PUBLICATION",
      resourceId: deleteFirst.publicationId,
      pid: deleteFirst.publicationPid,
      deleteSql: `DELETE FROM "Document" WHERE "id" = '${deleteFirst.documentId}'`,
      insertError: "PersistentIdentifier PUBLICATION resource does not exist",
    });
    assert.equal(await exists(control, "Document", deleteFirst.documentId), false);
    assert.equal(await exists(control, "Publication", deleteFirst.publicationId), false);
    assert.equal(await pidExists(control, deleteFirst.publicationPid.id), false);
  });
}

function idsFor(tag: string): FixtureIds {
  return {
    documentId: `pidc-doc-${tag}`,
    publicationId: `pidc-pub-${tag}`,
    documentPid: { id: `pidc-pid-doc-${tag}`, suffix: `concurrency.test.doc.${tag}` },
    publicationPid: { id: `pidc-pid-pub-${tag}`, suffix: `concurrency.test.pub.${tag}` },
  };
}

function insertPidSql(opts: PidSpec & { resourceType: ResourceType; resourceId: string }): string {
  const identifier = `bcu/${opts.suffix}`;
  return `INSERT INTO "PersistentIdentifier" (
    "id", "scheme", "prefix", "suffix", "identifier",
    "resourceType", "resourceId", "targetUrl", "status", "updatedAt"
  ) VALUES (
    '${opts.id}',
    'BICUNI_PID',
    'bcu',
    '${opts.suffix}',
    '${identifier}',
    '${opts.resourceType}',
    '${opts.resourceId}',
    '${FIXTURE_TARGET}',
    'ACTIVE',
    CURRENT_TIMESTAMP
  )`;
}

async function insertDocumentPublication(control: PsqlSession, ids: FixtureIds): Promise<void> {
  const doc = await control.query(`INSERT INTO "Document" ("id") VALUES ('${ids.documentId}')`);
  assert.equal(doc.stderr, "");
  const pub = await control.query(
    `INSERT INTO "Publication" ("id", "documentId") VALUES ('${ids.publicationId}', '${ids.documentId}')`,
  );
  assert.equal(pub.stderr, "");
}

async function exists(
  control: PsqlSession,
  table: "Document" | "Publication",
  id: string,
): Promise<boolean> {
  const { stdout, stderr } = await control.query(
    `SELECT COUNT(*)::text FROM "${table}" WHERE "id" = '${id}'`,
  );
  assert.equal(stderr, "");
  return stdout.trim() === "1";
}

async function pidExists(control: PsqlSession, id: string): Promise<boolean> {
  const { stdout, stderr } = await control.query(
    `SELECT COUNT(*)::text FROM "PersistentIdentifier" WHERE "id" = '${id}'`,
  );
  assert.equal(stderr, "");
  return stdout.trim() === "1";
}

async function pidFirstThenDelete(opts: {
  A: PsqlSession;
  B: PsqlSession;
  control: PsqlSession;
  resourceType: ResourceType;
  resourceId: string;
  pid: PidSpec;
  deleteSql: string;
  blockedError: string;
}): Promise<void> {
  const appA = `pidc-wait-${opts.pid.id}`;
  const appB = `pidc-hold-${opts.pid.id}`;
  await opts.B.query("BEGIN");
  await opts.B.query(`SET application_name = '${appB}'`);
  const inserted = await opts.B.query(
    insertPidSql({
      ...opts.pid,
      resourceType: opts.resourceType,
      resourceId: opts.resourceId,
    }),
  );
  assert.equal(inserted.stderr, "");

  await opts.A.query("BEGIN");
  await opts.A.query("SET lock_timeout = '15s'");
  await opts.A.query(`SET application_name = '${appA}'`);
  const deletePromise = opts.A.query(opts.deleteSql);
  await waitForLockWait(opts.control, appA);
  await opts.B.query("COMMIT");

  const deleted = await deletePromise;
  assertSqlException(deleted.stderr, opts.blockedError, opts.resourceId);
  await opts.A.query("ROLLBACK");
}

async function deleteFirstThenPid(opts: {
  A: PsqlSession;
  B: PsqlSession;
  control: PsqlSession;
  resourceType: ResourceType;
  resourceId: string;
  pid: PidSpec;
  deleteSql: string;
  insertError: string;
}): Promise<void> {
  const appA = `pidc-hold-${opts.pid.id}`;
  const appB = `pidc-wait-${opts.pid.id}`;
  await opts.A.query("BEGIN");
  await opts.A.query(`SET application_name = '${appA}'`);
  const deleted = await opts.A.query(opts.deleteSql);
  assert.equal(deleted.stderr, "");

  await opts.B.query("BEGIN");
  await opts.B.query("SET lock_timeout = '15s'");
  await opts.B.query(`SET application_name = '${appB}'`);
  const insertPromise = opts.B.query(
    insertPidSql({
      ...opts.pid,
      resourceType: opts.resourceType,
      resourceId: opts.resourceId,
    }),
  );
  await waitForLockWait(opts.control, appB);
  await opts.A.query("COMMIT");

  const inserted = await insertPromise;
  assertSqlException(inserted.stderr, opts.insertError, opts.resourceId);
  await opts.B.query("ROLLBACK");
}

function assertSqlException(stderr: string, message: string, resourceId: string): void {
  const errorLine = stderr.split("\n").find((line) => /^\s*ERROR:/.test(line)) ?? stderr;
  assert.match(errorLine, message);
  assert.notMatch(errorLine, resourceId);
}

async function waitForLockWait(control: PsqlSession, applicationName: string): Promise<void> {
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    const { stdout, stderr } = await control.query(
      `SELECT COALESCE(wait_event_type, '') FROM pg_stat_activity WHERE application_name = '${applicationName}' LIMIT 1`,
    );
    assert.equal(stderr, "");
    if (stdout.trim().split("\n")[0] === "Lock") return;
    await delay(25);
  }
  throw new Error(`session ${applicationName} did not wait on a row lock`);
}

async function withSessions(
  cluster: ThrowawayCluster,
  fn: (sessions: Sessions) => Promise<void>,
): Promise<void> {
  const A = cluster.connect();
  const B = cluster.connect();
  const control = cluster.connect();
  try {
    await fn({ A, B, control });
  } finally {
    await A.end();
    await B.end();
    await control.end();
  }
}

function isolatedEnv(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    HOME: process.env.HOME ?? os.tmpdir(),
    USER: process.env.USER ?? PG_USER,
    LOGNAME: process.env.LOGNAME ?? PG_USER,
    TMPDIR: os.tmpdir(),
    LANG: "C",
    LC_ALL: "C",
    NODE_ENV: "test",
  };
}

class PsqlSession {
  private readonly proc: ChildProcessWithoutNullStreams;
  private stdout = "";
  private stderr = "";
  private seq = 0;
  private waiters: Array<{
    marker: string;
    stdoutFrom: number;
    stderrFrom: number;
    resolve: (value: { stdout: string; stderr: string }) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  private exited = false;

  constructor(socketDir: string, port: string, database: string) {
    this.proc = spawn(
      "psql",
      ["-X", "-q", "-A", "-t", "-h", socketDir, "-p", port, "-U", PG_USER, "-d", database],
      { env: isolatedEnv(), stdio: ["pipe", "pipe", "pipe"] },
    );
    this.proc.stdout.setEncoding("utf8");
    this.proc.stderr.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk: string) => {
      this.stdout += chunk;
      this.flushWaiters();
    });
    this.proc.stderr.on("data", (chunk: string) => {
      this.stderr += chunk;
    });
    this.proc.on("exit", (code) => {
      this.exited = true;
      const error = new Error(`psql exited ${code ?? "null"}`);
      for (const waiter of this.waiters) {
        clearTimeout(waiter.timer);
        waiter.reject(error);
      }
      this.waiters = [];
    });
  }

  query(sql: string, timeoutMs = 20_000): Promise<{ stdout: string; stderr: string }> {
    if (this.exited) return Promise.reject(new Error("psql session already exited"));
    const marker = `---PID_SQL_${++this.seq}---`;
    const stdoutFrom = this.stdout.length;
    const stderrFrom = this.stderr.length;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((waiter) => waiter.marker !== marker);
        reject(new Error(`timeout waiting for ${marker}`));
      }, timeoutMs);
      this.waiters.push({ marker, stdoutFrom, stderrFrom, resolve, reject, timer });
      const terminated = /;\s*$/.test(sql) ? sql : `${sql};`;
      this.proc.stdin.write(`${terminated}\n\\echo ${marker}\n`);
      this.flushWaiters();
    });
  }

  async end(): Promise<void> {
    if (this.exited) return;
    try {
      this.proc.stdin.write("ROLLBACK;\n");
    } catch {
      // Session already closing.
    }
    this.proc.stdin.end();
    await Promise.race([
      new Promise<void>((resolve) => this.proc.once("exit", () => resolve())),
      delay(2_000),
    ]);
    if (!this.exited) this.proc.kill("SIGKILL");
  }

  private flushWaiters(): void {
    this.waiters = this.waiters.filter((waiter) => {
      const slice = this.stdout.slice(waiter.stdoutFrom);
      const idx = slice.indexOf(waiter.marker);
      if (idx < 0) return true;
      clearTimeout(waiter.timer);
      waiter.resolve({
        stdout: slice.slice(0, idx).trim(),
        stderr: this.stderr.slice(waiter.stderrFrom).trim(),
      });
      return false;
    });
  }
}

class ThrowawayCluster {
  constructor(
    readonly dataDir: string,
    readonly port: string,
  ) {}

  get socketDir(): string {
    return this.dataDir;
  }

  connect(): PsqlSession {
    return new PsqlSession(this.socketDir, this.port, PG_DATABASE);
  }

  async apply(sql: string): Promise<void> {
    await runPsql(this.socketDir, this.port, PG_DATABASE, sql);
  }

  async stop(): Promise<void> {
    try {
      await execFileAsync("pg_ctl", ["-D", this.dataDir, "-m", "immediate", "-w", "stop"], {
        env: isolatedEnv(),
        timeout: 15_000,
      });
    } catch {
      // Cluster may already be stopped.
    }
    await rm(this.dataDir, { recursive: true, force: true });
  }
}

async function startThrowawayPostgres(): Promise<ThrowawayCluster> {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "pid-concurrency-"));
  const port = String(55_000 + Math.floor(Math.random() * 1_000));
  try {
    await runExec("initdb", [
      "-D",
      dataDir,
      "--auth-local=trust",
      "--auth-host=reject",
      `--username=${PG_USER}`,
      "--encoding=UTF8",
      "--locale=C",
      "--no-sync",
    ]);
    await runExec("pg_ctl", [
      "-D",
      dataDir,
      "-l",
      path.join(dataDir, "pg.log"),
      "-w",
      "-t",
      "20",
      "start",
      "-o",
      `-c listen_addresses='' -c unix_socket_directories='${dataDir}' -c unix_socket_permissions=0700 -c port=${port} -c fsync=off -c synchronous_commit=off -c full_page_writes=off`,
    ]);
    await runPsql(dataDir, port, "postgres", `CREATE DATABASE ${PG_DATABASE}`);
    return new ThrowawayCluster(dataDir, port);
  } catch (error) {
    try {
      await execFileAsync("pg_ctl", ["-D", dataDir, "-m", "immediate", "stop"], {
        env: isolatedEnv(),
        timeout: 10_000,
      });
    } catch {
      // Not started.
    }
    await rm(dataDir, { recursive: true, force: true });
    throw error;
  }
}

async function runExec(command: string, args: string[]): Promise<void> {
  try {
    await execFileAsync(command, args, { env: isolatedEnv(), timeout: 30_000 });
  } catch (error) {
    const err = error as { message: string; stderr?: string; stdout?: string; signal?: string };
    throw new Error(
      [err.message, err.stderr?.trim(), err.stdout?.trim(), err.signal ? `signal=${err.signal}` : ""]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

function runPsql(socketDir: string, port: string, database: string, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "psql",
      ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", socketDir, "-p", port, "-U", PG_USER, "-d", database],
      { env: isolatedEnv(), stdio: ["pipe", "pipe", "pipe"] },
    );
    let stderr = "";
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `psql exited ${code ?? "null"}`));
    });
    proc.stdin.end(sql);
  });
}

function isolatedSchemaSql(migrationSql: string): string {
  const types = [...migrationSql.matchAll(/CREATE TYPE "[^"]+" AS ENUM \([^)]+\);/g)].map(
    (match) => match[0],
  );
  if (types.length < 3) throw new Error("missing PID enum types in migration");
  const table = migrationSql.match(/CREATE TABLE "PersistentIdentifier" \([\s\S]*?\);/)?.[0];
  if (!table) throw new Error("missing PersistentIdentifier table in migration");
  const indexes = [
    ...migrationSql.matchAll(
      /CREATE UNIQUE INDEX "PersistentIdentifier_[^"]+" ON "PersistentIdentifier"\([^)]+\);/g,
    ),
  ].map((match) => match[0]);
  const functionsStart = migrationSql.indexOf(
    "CREATE OR REPLACE FUNCTION prevent_persistent_identifier_identity_mutation",
  );
  if (functionsStart < 0) throw new Error("missing PID trigger functions in migration");
  return [
    `CREATE TABLE "Document" ("id" TEXT PRIMARY KEY);`,
    `CREATE TABLE "Publication" (
      "id" TEXT PRIMARY KEY,
      "documentId" TEXT NOT NULL UNIQUE,
      CONSTRAINT "Publication_document_fkey"
        FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE
    );`,
    ...types,
    table,
    ...indexes,
    migrationSql.slice(functionsStart),
  ].join("\n");
}

const assert = {
  equal(actual: unknown, expected: unknown): void {
    if (actual !== expected) {
      throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
  match(actual: string, expected: string): void {
    if (!actual.includes(expected)) {
      throw new Error(`expected text to include ${JSON.stringify(expected)}`);
    }
  },
  notMatch(actual: string, forbidden: string): void {
    if (actual.includes(forbidden)) {
      throw new Error("exception leaked a resource identifier");
    }
  },
};

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  process.stdout.write(`PASS ${name}\n`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown error";
  process.stderr.write(`FAIL ${message}\n`);
  process.exitCode = 1;
});
