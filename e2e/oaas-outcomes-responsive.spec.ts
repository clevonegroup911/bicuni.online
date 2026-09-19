/**
 * E2E OaaS responsive — catalogue + parcours mission UI aux viewports 1280 / 834 / 390.
 * Prépare une mission réelle (PostgreSQL) ; ne mocke pas les libellés d’exécuteur.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { hash } from "bcryptjs";
import {
  createMission,
  decideContract,
  qualifyMission,
  quoteAndIssueContract,
} from "../lib/oaas/mission-service";
import {
  buildExecutionPlan,
  decideApproval,
  runOrchestratorUntilPause,
} from "../lib/oaas/orchestrator";
import { confirmTestOutcomePayment } from "../lib/oaas/test-payment";
import { formatExecutorKindLabel } from "../lib/oaas/agents";

const db = new PrismaClient();
const runId = randomUUID().slice(0, 8);

const VIEWPORTS = [
  { name: "1280", width: 1280, height: 800 },
  { name: "834", width: 834, height: 1194 },
  { name: "390", width: 390, height: 844 },
] as const;

type ViewportReport = {
  name: string;
  width: number;
  innerWidth: number;
  scrollWidth: number;
  overflow: boolean;
};

const viewportReports: ViewportReport[] = [];

async function assertNoHorizontalOverflow(page: Page, label: string): Promise<ViewportReport> {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      innerWidth: window.innerWidth,
      scrollWidth: doc.scrollWidth,
      overflow: doc.scrollWidth > window.innerWidth,
    };
  });
  expect(metrics.overflow, `${label}: scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`).toBe(
    false,
  );
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
  return {
    name: label,
    width: metrics.innerWidth,
    innerWidth: metrics.innerWidth,
    scrollWidth: metrics.scrollWidth,
    overflow: metrics.overflow,
  };
}

async function assertNoUnexpectedPageErrors(page: Page, navigate: () => Promise<void>) {
  const pageErrors: string[] = [];
  const onError = (error: Error) => pageErrors.push(error.message);
  page.on("pageerror", onError);
  try {
    await navigate();
    expect(pageErrors, `erreurs JS inattendues: ${pageErrors.join(" | ")}`).toEqual([]);
  } finally {
    page.off("pageerror", onError);
  }
}

async function assertKeyboardReachable(page: Page, name: RegExp | string) {
  const target = page.getByRole("link", { name }).or(page.getByRole("button", { name })).first();
  await expect(target).toBeVisible();
  await target.focus();
  await expect(target).toBeFocused();
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/Adresse e-mail|email/i).fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /Se connecter/i }).click();
  await expect(page).toHaveURL(/\/(dashboard|outcomes)/, { timeout: 30_000 });
}

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("OaaS responsive mission coverage", () => {
  test("1280 / 834 / 390 : overflow zéro + UI mission honnête", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Couverture responsive exécutée une fois (desktop + setViewportSize).");

    expect(formatExecutorKindLabel("REAL_EXECUTOR")).toBe("Exécuteur externe réel");

    const password = "TestOaasResponsive!2026";
    const passwordHash = await hash(password, 10);
    const email = `oaas-r-${runId}@example.test`;
    const owner = await db.user.create({
      data: {
        email,
        name: "TEST OaaS Responsive",
        role: "STUDENT",
        status: "ACTIVE",
        emailVerified: new Date(),
        passwordHash,
      },
    });

    const mission = await createMission(db, {
      ownerId: owner.id,
      packSlug: "academic-research",
      title: `[TEST] Mission responsive ${runId}`,
      originalRequest: "[TEST] Responsive OaaS — fixtures uniquement.",
      expectedOutcome: "[TEST] Vérifier overflow et libellés exécuteur.",
      academicDomain: "Informatique",
      academicLevel: "Master",
      sources: [
        {
          label: `[TEST] Source responsive ${runId}`,
          uri: "https://example.test/fixtures/responsive",
          accessible: true,
          notes: "Fixture TEST",
        },
      ],
    });

    await qualifyMission(db, mission.id, owner.id);
    await quoteAndIssueContract(db, { missionId: mission.id, actorId: owner.id });
    await decideContract(db, { missionId: mission.id, actorId: owner.id, decision: "accept" });
    await confirmTestOutcomePayment(db, {
      missionId: mission.id,
      userId: owner.id,
      idempotencyKey: `e2e-oaas-responsive:${runId}:pay`,
    });
    await buildExecutionPlan(db, mission.id, owner.id);

    // Expose ADAPTER_NOT_CONFIGURED + DISABLED on the mission detail for honesty checks.
    for (const key of ["ocr", "metadata"] as const) {
      const agent = await db.outcomeAgent.findUniqueOrThrow({ where: { key } });
      const task = await db.outcomeTask.create({
        data: {
          missionId: mission.id,
          key: `honesty-${key}-${runId}`,
          title: `[TEST] Honesty ${key}`,
          description: "Assignment TEST pour libellés d’exécuteur",
          agentKey: key,
          status: "SKIPPED",
        },
      });
      await db.outcomeAgentAssignment.create({
        data: { missionId: mission.id, taskId: task.id, agentId: agent.id, role: "observer" },
      });
    }

    let pause = await runOrchestratorUntilPause(db, mission.id, owner.id);
    if (pause.status === "AWAITING_HUMAN_REVIEW") {
      const approval = await db.outcomeApproval.findFirstOrThrow({
        where: { missionId: mission.id, status: "PENDING" },
      });
      await decideApproval(db, { approvalId: approval.id, actorId: owner.id, decision: "APPROVED" });
      pause = await runOrchestratorUntilPause(db, mission.id, owner.id);
    }
    expect(["DELIVERED", "COMPLETED", "AWAITING_HUMAN_REVIEW", "READY", "EXECUTING"]).toContain(pause.status);

    await loginAs(page, email, password);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await assertNoUnexpectedPageErrors(page, async () => {
        await page.goto("/outcomes", { waitUntil: "domcontentloaded" });
      });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: /Décrire le résultat|Commander ce résultat/i }).first()).toBeVisible();
      viewportReports.push(await assertNoHorizontalOverflow(page, `/outcomes@${vp.name}`));
      await assertKeyboardReachable(page, /Décrire le résultat|Commander ce résultat/i);

      await assertNoUnexpectedPageErrors(page, async () => {
        await page.goto("/dashboard/missions/new?pack=academic-research", { waitUntil: "domcontentloaded" });
      });
      await expect(page.getByRole("heading", { level: 1, name: /Résultat attendu/i })).toBeVisible();
      await expect(page.getByText(/Assistant de mission/i)).toBeVisible();
      viewportReports.push(await assertNoHorizontalOverflow(page, `/missions/new@${vp.name}`));

      await assertNoUnexpectedPageErrors(page, async () => {
        await page.goto("/dashboard/missions", { waitUntil: "domcontentloaded" });
      });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(mission.publicRef)).toBeVisible();
      viewportReports.push(await assertNoHorizontalOverflow(page, `/missions@${vp.name}`));
      await assertKeyboardReachable(page, /Ouvrir|Décrire le résultat/i);

      await assertNoUnexpectedPageErrors(page, async () => {
        await page.goto(`/dashboard/missions/${mission.id}`, { waitUntil: "domcontentloaded" });
      });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // publicRef appears in breadcrumb + eyebrow — assert at least one, not unique.
      await expect(page.getByText(mission.publicRef).first()).toBeVisible();

      await expect(page.getByRole("heading", { name: /Progression|Agents assignés/i }).first()).toBeVisible();
      await expect(page.getByText(/Exécuteur local déterministe/).first()).toBeVisible();
      await expect(page.getByText(/Adaptateur non configuré/).first()).toBeVisible();
      await expect(page.getByText(/Fonction désactivée/).first()).toBeVisible();
      // 0 REAL_EXECUTOR in registry — must not appear as an active/available agent label on this mission.
      await expect(page.getByText(/Exécuteur externe réel/)).toHaveCount(0);

      await expect(page.getByRole("heading", { name: /Contrôles qualité|Approbations|Preuves|Livrables|Factures/i }).first()).toBeVisible();
      await expect(page.getByText(/PASS|Preuves|Livrable|Facture|TEST-|paiement/i).first()).toBeVisible();

      const detailReport = await assertNoHorizontalOverflow(page, `/missions/${mission.id}@${vp.name}`);
      viewportReports.push(detailReport);

      // No inaccessible primary CTA after focus cycle.
      await page.keyboard.press("Tab");
      const active = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return { ok: true, tag: "body" };
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const hidden =
          style.visibility === "hidden" ||
          style.display === "none" ||
          (rect.width === 0 && rect.height === 0);
        return { ok: !hidden, tag: el.tagName };
      });
      expect(active.ok, `élément focus inaccessible (${active.tag}) @${vp.name}`).toBe(true);
    }

    // Surface viewport metrics in the Playwright report annotation.
    testInfo.annotations.push({
      type: "viewport-overflow-report",
      description: JSON.stringify(viewportReports),
    });
    expect(viewportReports.every((r) => !r.overflow)).toBe(true);
    expect(viewportReports.some((r) => r.name.includes("1280"))).toBe(true);
    expect(viewportReports.some((r) => r.name.includes("834"))).toBe(true);
    expect(viewportReports.some((r) => r.name.includes("390"))).toBe(true);
  });
});
