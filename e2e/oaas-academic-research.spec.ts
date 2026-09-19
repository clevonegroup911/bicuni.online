/**
 * E2E OaaS — parcours réel sur PostgreSQL (pas de mocks silencieux).
 * Nécessite DATABASE_URL pointant vers une base migrée + seed OaaS.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { hash } from "bcryptjs";
import {
  acceptMission,
  createMission,
  decideContract,
  getMissionForOwner,
  qualifyMission,
  quoteAndIssueContract,
} from "../lib/oaas/mission-service";
import {
  buildExecutionPlan,
  decideApproval,
  runOrchestratorUntilPause,
} from "../lib/oaas/orchestrator";
import { confirmTestOutcomePayment } from "../lib/oaas/test-payment";
import { assertAgentCanExecute, STRIPE_OAAS_STATUS } from "../lib/oaas/agents";
import { canTransition } from "../lib/oaas/state-machine";

const db = new PrismaClient();
const runId = randomUUID().slice(0, 8);

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("OaaS academic-research vertical slice", () => {
  test("parcours complet : devis → paiement TEST → agents → QG → livraison → acceptation", async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Parcours OaaS exécuté une seule fois (desktop).");

    expect(STRIPE_OAAS_STATUS).toBe("ADAPTER_NOT_CONFIGURED");
    expect(() => assertAgentCanExecute("ocr")).toThrow();

    const passwordHash = await hash("TestOaas!2026", 10);
    const owner = await db.user.create({
      data: {
        email: `oaas-a-${runId}@example.test`,
        name: "TEST OaaS A",
        role: "STUDENT",
        status: "ACTIVE",
        emailVerified: new Date(),
        passwordHash,
      },
    });
    const other = await db.user.create({
      data: {
        email: `oaas-b-${runId}@example.test`,
        name: "TEST OaaS B",
        role: "STUDENT",
        status: "ACTIVE",
        emailVerified: new Date(),
        passwordHash,
      },
    });

    const mission = await createMission(db, {
      ownerId: owner.id,
      packSlug: "academic-research",
      title: `[TEST] Mission E2E ${runId}`,
      originalRequest: "[TEST] Dossier de recherche sourcé sur agriculture durable — fixtures uniquement.",
      expectedOutcome: "[TEST] Problématique, sources, bibliographie, synthèse et preuves.",
      academicDomain: "Agronomie",
      academicLevel: "Master",
      sources: [
        {
          label: `[TEST] Source FAO ${runId}`,
          uri: "https://example.test/fixtures/fao",
          accessible: true,
          notes: "Fixture TEST",
        },
        {
          label: `[TEST] Source inaccessible ${runId}`,
          uri: "https://example.test/fixtures/gone",
          accessible: false,
        },
      ],
    });

    await qualifyMission(db, mission.id, owner.id);
    const quoted = await quoteAndIssueContract(db, { missionId: mission.id, actorId: owner.id });
    expect(quoted.contract?.priceCents).toBe(4900);
    expect(quoted.contract?.status).toBe("ISSUED");

    await decideContract(db, { missionId: mission.id, actorId: owner.id, decision: "accept" });

    const pay1 = await confirmTestOutcomePayment(db, {
      missionId: mission.id,
      userId: owner.id,
      idempotencyKey: `e2e-oaas:${runId}:pay`,
    });
    expect(pay1.test).toBe(true);
    expect(pay1.status).toBe("PAID");
    expect(pay1.publicRef?.startsWith("TEST-")).toBe(true);

    const pay2 = await confirmTestOutcomePayment(db, {
      missionId: mission.id,
      userId: owner.id,
      idempotencyKey: `e2e-oaas:${runId}:pay`,
    });
    expect(pay2.reused).toBe(true);

    const afterPay = await db.outcomeMission.findUniqueOrThrow({ where: { id: mission.id } });
    expect(afterPay.status).toBe("PLANNED");
    expect(afterPay.paidAt).toBeTruthy();

    await buildExecutionPlan(db, mission.id, owner.id);

    let pause = await runOrchestratorUntilPause(db, mission.id, owner.id);
    expect(pause.status).toBe("AWAITING_HUMAN_REVIEW");

    const approval = await db.outcomeApproval.findFirstOrThrow({
      where: { missionId: mission.id, status: "PENDING" },
    });
    await decideApproval(db, { approvalId: approval.id, actorId: owner.id, decision: "APPROVED" });

    pause = await runOrchestratorUntilPause(db, mission.id, owner.id);
    expect(pause.status).toBe("DELIVERED");

    const delivered = await getMissionForOwner(db, mission.id, owner.id);
    expect(delivered.deliverables.length).toBeGreaterThan(0);
    expect(delivered.evidences.length).toBeGreaterThan(0);
    expect(delivered.qualityChecks.every((q) => q.verdict === "PASS")).toBe(true);
    expect(delivered.invoices.some((i) => i.status === "paid")).toBe(true);
    expect(delivered.paymentIntents.some((p) => p.publicRef.startsWith("TEST-"))).toBe(true);

    const journals = await db.outcomeAgentJournal.findMany({ where: { missionId: mission.id } });
    expect(journals.length).toBeGreaterThan(0);
    expect(journals.some((j) => {
      const detail = j.detail as { executorKind?: string } | null;
      return detail?.executorKind === "DETERMINISTIC_LOCAL";
    })).toBe(true);

    await expect(getMissionForOwner(db, mission.id, other.id)).rejects.toMatchObject({ status: 404 });

    expect(canTransition("DELIVERED", "EXECUTING")).toBe(false);

    await acceptMission(db, { missionId: mission.id, actorId: owner.id, decision: "ACCEPTED" });
    const done = await db.outcomeMission.findUniqueOrThrow({ where: { id: mission.id } });
    expect(done.status).toBe("COMPLETED");

    // Étudiant ne doit pas être SUPER_ADMIN
    expect(owner.role).toBe("STUDENT");
  });
});
