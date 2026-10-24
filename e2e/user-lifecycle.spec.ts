import { createHash, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const db = new PrismaClient();
const password = "Bicuni-Lifecycle-2026";

function tokenHash(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

async function cleanupEmail(email: string) {
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;
  await db.verificationToken.deleteMany({ where: { identifier: email } });
  await db.user.delete({ where: { id: user.id } });
}

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("cycle de vie utilisateur", () => {
  test("inscription → PENDING → vérification → ACTIVE → connexion", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Parcours DB unique");
    const email = `life-happy-${randomUUID()}@example.test`;
    const rawToken = `tok-${randomUUID()}`;
    try {
      const registration = await request.post("/api/auth/register", {
        data: { name: "Lifecycle Happy", email, password },
        headers: { "x-forwarded-for": `e2e-${randomUUID()}` },
      });
      expect(registration.status()).toBe(201);

      const pending = await db.user.findUniqueOrThrow({ where: { email } });
      expect(pending.status).toBe("PENDING");
      expect(pending.emailVerified).toBeNull();

      await db.verificationToken.deleteMany({ where: { identifier: email } });
      await db.verificationToken.create({
        data: { identifier: email, token: tokenHash(rawToken), expires: new Date(Date.now() + 60_000) },
      });

      const verify = await request.post("/api/auth/verify-email", {
        data: { email, token: rawToken },
      });
      expect(verify.ok()).toBe(true);

      const active = await db.user.findUniqueOrThrow({ where: { email } });
      expect(active.status).toBe("ACTIVE");
      expect(active.emailVerified).not.toBeNull();

      await page.goto("/login");
      await page.getByLabel("Adresse e-mail").fill(email);
      await page.locator('input[name="password"]').fill(password);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    } finally {
      await cleanupEmail(email);
    }
  });

  test("renvoi de vérification puis activation", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Parcours DB unique");
    const email = `life-resend-${randomUUID()}@example.test`;
    try {
      expect((await request.post("/api/auth/register", {
        data: { name: "Lifecycle Resend", email, password },
        headers: { "x-forwarded-for": `e2e-${randomUUID()}` },
      })).status()).toBe(201);

      const resend = await request.post("/api/auth/resend-verification", {
        data: { email },
        headers: { "x-forwarded-for": `e2e-${randomUUID()}` },
      });
      expect(resend.status()).toBe(202);
      const body = await resend.json() as { message: string };
      expect(body.message).toMatch(/Si ce compte attend/);

      const stored = await db.verificationToken.findFirstOrThrow({ where: { identifier: email } });
      // Inject known token after resend rotated an unknown one
      const known = `known-${randomUUID()}`;
      await db.verificationToken.deleteMany({ where: { identifier: email } });
      await db.verificationToken.create({
        data: { identifier: email, token: tokenHash(known), expires: new Date(Date.now() + 60_000) },
      });
      void stored;

      const verify = await request.post("/api/auth/verify-email", { data: { email, token: known } });
      expect(verify.ok()).toBe(true);
      const user = await db.user.findUniqueOrThrow({ where: { email } });
      expect(user.status).toBe("ACTIVE");
    } finally {
      await cleanupEmail(email);
    }
  });

  test("jeton expiré ou déjà utilisé → refus", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Parcours DB unique");
    const email = `life-expired-${randomUUID()}@example.test`;
    const raw = `expired-${randomUUID()}`;
    try {
      await db.user.create({
        data: {
          email,
          name: "Expired Token",
          passwordHash: await hash(password, 12),
          status: "PENDING",
          role: "USER",
          profile: { create: {} },
        },
      });
      await db.verificationToken.create({
        data: { identifier: email, token: tokenHash(raw), expires: new Date(Date.now() - 1_000) },
      });
      const expired = await request.post("/api/auth/verify-email", { data: { email, token: raw } });
      expect(expired.status()).toBe(400);

      const fresh = `fresh-${randomUUID()}`;
      await db.verificationToken.deleteMany({ where: { identifier: email } });
      await db.verificationToken.create({
        data: { identifier: email, token: tokenHash(fresh), expires: new Date(Date.now() + 60_000) },
      });
      expect((await request.post("/api/auth/verify-email", { data: { email, token: fresh } })).ok()).toBe(true);
      const reused = await request.post("/api/auth/verify-email", { data: { email, token: fresh } });
      expect(reused.status()).toBe(400);
    } finally {
      await cleanupEmail(email);
    }
  });

  test("compte suspendu → connexion refusée", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Parcours DB unique");
    const email = `life-suspend-${randomUUID()}@example.test`;
    try {
      await db.user.create({
        data: {
          email,
          name: "Suspended User",
          passwordHash: await hash(password, 12),
          status: "SUSPENDED",
          emailVerified: new Date(),
          role: "USER",
          profile: { create: {} },
        },
      });
      await page.goto("/login");
      await page.getByLabel("Adresse e-mail").fill(email);
      await page.locator('input[name="password"]').fill(password);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await expect(page.locator(".form-error")).toBeVisible({ timeout: 30_000 });
      await expect(page).not.toHaveURL(/\/dashboard/);
    } finally {
      await cleanupEmail(email);
    }
  });

  test("compte suspendu + ancien lien de vérification → réactivation interdite", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Parcours DB unique");
    const email = `life-suspend-token-${randomUUID()}@example.test`;
    const raw = `stale-${randomUUID()}`;
    try {
      await db.user.create({
        data: {
          email,
          name: "Suspended Token",
          passwordHash: await hash(password, 12),
          status: "SUSPENDED",
          emailVerified: new Date(),
          role: "USER",
          profile: { create: {} },
        },
      });
      await db.verificationToken.create({
        data: { identifier: email, token: tokenHash(raw), expires: new Date(Date.now() + 60_000) },
      });
      const verify = await request.post("/api/auth/verify-email", { data: { email, token: raw } });
      expect(verify.status()).toBe(400);
      const user = await db.user.findUniqueOrThrow({ where: { email } });
      expect(user.status).toBe("SUSPENDED");
      expect(await db.verificationToken.count({ where: { identifier: email } })).toBe(0);
    } finally {
      await cleanupEmail(email);
    }
  });

  test("réactivation admin d’un compte vérifié → accès restauré", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Parcours DB unique");
    const email = `life-reactivate-${randomUUID()}@example.test`;
    try {
      const user = await db.user.create({
        data: {
          email,
          name: "Reactivate User",
          passwordHash: await hash(password, 12),
          status: "SUSPENDED",
          emailVerified: new Date(),
          role: "USER",
          profile: { create: {} },
        },
      });
      await db.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });

      await page.goto("/login");
      await page.getByLabel("Adresse e-mail").fill(email);
      await page.locator('input[name="password"]').fill(password);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    } finally {
      await cleanupEmail(email);
    }
  });

  test("renvoi self-service reste neutre pour email inconnu", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Parcours DB unique");
    const resend = await request.post("/api/auth/resend-verification", {
      data: { email: `ghost-${randomUUID()}@example.test` },
      headers: { "x-forwarded-for": `e2e-${randomUUID()}` },
    });
    expect(resend.status()).toBe(202);
    const body = await resend.json() as { message: string };
    expect(body.message).toMatch(/Si ce compte attend/);
  });
});
