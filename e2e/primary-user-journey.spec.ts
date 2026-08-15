import { createHash, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const db = new PrismaClient();
const email = `e2e-${randomUUID()}@example.test`;
const password = "Bicuni-Test-2026";

test.afterAll(async () => {
  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (user) await db.user.delete({ where: { id: user.id } });
  await db.$disconnect();
});

test("inscription, vérification, connexion, session et déconnexion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Le parcours Auth avec écritures en base ne doit être exécuté qu’une fois.");
  await page.goto("/signup");
  await page.getByLabel("Nom complet").fill("Utilisateur E2E");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("status")).toContainText("Compte créé", { timeout: 30_000 });

  const verificationToken = `bicuni-e2e-${randomUUID()}`;
  await db.verificationToken.deleteMany({ where: { identifier: email } });
  await db.verificationToken.create({
    data: {
      identifier: email,
      token: createHash("sha256").update(verificationToken).digest("hex"),
      expires: new Date(Date.now() + 60_000),
    },
  });

  await page.goto(`/verify-email?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(email)}`);
  await expect(page.getByRole("status")).toContainText("Adresse vérifiée", { timeout: 30_000 });

  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const plan = await db.plan.findUniqueOrThrow({ where: { slug: "starter" } });
  await db.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      provider: "STRIPE",
      providerRef: `e2e-${randomUUID()}`,
      status: "ACTIVE",
      startedAt: new Date(),
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    },
  });

  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Votre espace académique" })).toBeVisible();

  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("pages publiques sans overflow horizontal", async ({ page }) => {
  for (const route of ["/", "/search", "/documents", "/library", "/universities", "/pricing", "/login", "/signup"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow, `${route} ne doit pas déborder horizontalement`).toBe(false);
  }
});

test("mot de passe oublié, réinitialisation, utilisateur non vérifié et session expirée", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Le parcours Auth backend ne doit être exécuté qu’une fois.");
  const authEmail = `auth-${randomUUID()}@example.test`;
  const resetToken = `bicuni-reset-${randomUUID()}`;
  try {
    const registration = await request.post("/api/auth/register", {
      data: { name: "Compte Auth E2E", email: authEmail, password, role: "STUDENT" },
      headers: { "x-forwarded-for": `e2e-${randomUUID()}` },
    });
    expect(registration.status()).toBe(201);
    const user = await db.user.findUniqueOrThrow({ where: { email: authEmail } });
    await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });

    const forgot = await request.post("/api/auth/forgot-password", { data: { email: authEmail } });
    expect(forgot.status()).toBe(202);
    await db.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(resetToken).digest("hex"), expires: new Date(Date.now() + 60_000) } });
    const reset = await request.post("/api/auth/reset-password", { data: { token: resetToken, password: "Bicuni-New-Password-2026" } });
    expect(reset.ok()).toBe(true);

    await db.user.update({ where: { id: user.id }, data: { emailVerified: null } });
    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(authEmail);
    await page.locator('input[name="password"]').fill("Bicuni-New-Password-2026");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator(".form-error")).toContainText("non vérifiée", { timeout: 30_000 });

    await page.context().addCookies([{ name: "authjs.session-token", value: "expired-or-invalid", domain: "127.0.0.1", path: "/", expires: Math.floor(Date.now() / 1000) - 60 }]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=/);
  } finally {
    await db.user.deleteMany({ where: { email: authEmail } });
  }
});

test("profil, facture propriétaire et services Stripe absents sans faux succès", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Le contrat compte Sprint 002 ne doit être exécuté qu’une fois.");
  const accountEmail = `account-${randomUUID()}@example.test`;
  const accountPassword = "Bicuni-Account-2026";
  const providerRef = `in_test_${randomUUID()}`;
  const plan = await db.plan.findUniqueOrThrow({ where: { slug: "starter" } });
  const user = await db.user.create({
    data: {
      email: accountEmail,
      name: "Compte E2E",
      passwordHash: await hash(accountPassword, 12),
      emailVerified: new Date(),
      status: "ACTIVE",
      role: "STUDENT",
      subscriptions: {
        create: {
          planId: plan.id,
          provider: "STRIPE",
          providerRef: `sub_test_${randomUUID()}`,
          status: "ACTIVE",
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          invoices: {
            create: {
              provider: "STRIPE",
              providerRef,
              number: "TEST-INV-002",
              amountDueCents: 200,
              amountPaidCents: 200,
              currency: "USD",
              status: "paid",
            },
          },
        },
      },
    },
  });

  try {
    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(accountEmail);
    await page.locator('input[name="password"]').fill(accountPassword);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });

    await page.goto("/dashboard/profile");
    await page.getByLabel("Nom").fill("Compte E2E intégré");
    await page.getByLabel("Titre académique").fill("Chercheur test");
    await page.getByLabel("Biographie").fill("Profil de test d’intégration explicitement marqué E2E.");
    await page.getByLabel("Pays").fill("CD");
    await page.getByLabel("Site").fill("https://example.test/profile");
    await page.getByLabel("Avatar (URL)").fill("https://example.test/avatar.png");
    await page.getByLabel("Domaines de recherche").fill("sécurité, intégration");
    await page.getByRole("button", { name: "Enregistrer le profil" }).click();
    await expect(page.getByRole("status")).toContainText("Profil enregistré", { timeout: 30_000 });
    await expect(db.user.findUniqueOrThrow({ where: { id: user.id }, include: { profile: true } })).resolves.toMatchObject({
      name: "Compte E2E intégré",
      image: "https://example.test/avatar.png",
      profile: { title: "Chercheur test", researchFields: ["sécurité", "intégration"] },
    });

    const result = await page.evaluate(async (expectedNumber) => {
      const invoices = await fetch("/api/invoices?page=1&limit=10");
      const invoicePayload = await invoices.json();
      const portal = await fetch("/api/payments/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const cancellation = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atPeriodEnd: true }),
      });
      return {
        invoiceStatus: invoices.status,
        ownsInvoice: invoicePayload.invoices?.some((invoice: { number?: string }) => invoice.number === expectedNumber) ?? false,
        pagination: invoicePayload.pagination,
        portalStatus: portal.status,
        cancellationStatus: cancellation.status,
      };
    }, "TEST-INV-002");
    expect(result).toMatchObject({
      invoiceStatus: 200,
      ownsInvoice: true,
      pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      portalStatus: 503,
      cancellationStatus: 503,
    });
  } finally {
    await db.user.delete({ where: { id: user.id } });
  }
});
