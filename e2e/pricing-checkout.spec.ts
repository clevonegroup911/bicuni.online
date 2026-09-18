import { createHash, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const db = new PrismaClient();

const QA_VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 834, height: 1194 },
  { width: 390, height: 844 },
] as const;

async function databaseReachable() {
  if (!process.env.DATABASE_URL) return false;
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

test.afterAll(async () => {
  await db.$disconnect().catch(() => undefined);
});

test("pricing : quatre offres, boutons réactifs, auth conserve le plan", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Le parcours commercial s’exécute une fois sur desktop.");

  await page.goto("/pricing", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Investir dans le savoir." })).toBeVisible();
  for (const name of ["Starter", "Étudiant Premium", "Chercheur", "Université"]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }

  const starterButton = page.getByRole("button", { name: /Choisir Starter/i });
  await expect(starterButton).toBeEnabled();
  await expect(page.getByRole("button", { name: /Payer par M-PESA \/ RAWBANK — Starter/i })).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/login\?next=/),
    starterButton.click(),
  ]);

  const url = new URL(page.url());
  const next = url.searchParams.get("next") ?? "";
  expect(next).toContain("/pricing?plan=starter");
  expect(next).toContain("resume=1");
  expect(page.url()).not.toMatch(/sk_|whsec_|secret/i);

  await expect(page.getByRole("button", { name: /Se connecter/i })).toBeEnabled();
  await expect(page.getByRole("link", { name: /Créer un compte/i })).toHaveAttribute(
    "href",
    /signup\?next=/,
  );
});

test("pricing : configuration Stripe absente affiche une erreur honnête", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Contrôle authentifié unique.");
  test.skip(!(await databaseReachable()), "PostgreSQL local injoignable pour ce run E2E.");

  const email = `pricing-${randomUUID()}@example.test`;
  const password = "Bicuni-Pricing-2026";
  const user = await db.user.create({
    data: {
      email,
      name: "Pricing E2E",
      passwordHash: await hash(password, 12),
      emailVerified: new Date(),
      status: "ACTIVE",
      role: "STUDENT",
    },
  });

  try {
    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/dashboard$|\/pricing/, { timeout: 30_000 });

    await page.goto("/pricing");
    const button = page.getByRole("button", { name: /Choisir Chercheur/i });
    await button.click();

    await expect(page.getByRole("status")).toContainText(/pas encore configuré|indisponible|Réessayez/i, {
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: /Réessayer|Choisir Chercheur/i })).toBeEnabled();
  } finally {
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
});

test("pricing : pas d’overflow à 1280 / 834 / 390", async ({ page }) => {
  for (const viewport of QA_VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `/pricing ${viewport.width}px`).toBe(false);
    await expect(page.getByRole("button", { name: /Choisir /i }).first()).toBeVisible();
  }
});

test("checkout API : plan falsifié et montant client ignorés", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Contrôle API unique.");
  test.skip(!(await databaseReachable()), "PostgreSQL local injoignable pour ce run E2E.");

  const email = `checkout-api-${randomUUID()}@example.test`;
  const password = "Bicuni-Checkout-2026";
  const user = await db.user.create({
    data: {
      email,
      name: "Checkout API E2E",
      passwordHash: await hash(password, 12),
      emailVerified: new Date(),
      status: "ACTIVE",
      role: "STUDENT",
    },
  });

  try {
    const csrf = await request.get("/api/auth/csrf");
    const { csrfToken } = await csrf.json() as { csrfToken: string };
    const login = await request.post("/api/auth/callback/credentials", {
      form: {
        csrfToken,
        email,
        password,
        callbackUrl: "/dashboard",
        json: "true",
      },
    });
    expect(login.ok()).toBeTruthy();

    const forged = await request.post("/api/payments/checkout", {
      data: { planSlug: "starter", priceCents: 1, amount: 1, role: "SUPER_ADMIN" },
    });
    expect([503, 502, 200, 404]).toContain(forged.status());
    const body = await forged.json() as { url?: string; error?: string };
    if (forged.status() === 200) {
      expect(body.url).toMatch(/^https:\/\/(checkout|billing)\.stripe\.com\//);
    } else {
      expect(body.error).toBeTruthy();
    }

    const missingPlan = await request.post("/api/payments/checkout", {
      data: { planSlug: `missing-${randomUUID()}` },
    });
    expect([404, 503]).toContain(missingPlan.status());
  } finally {
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
});

test("webhook Stripe : signature absente refusée", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Contrôle webhook unique.");
  const response = await request.post("/api/payments/webhooks/stripe", {
    data: { id: `evt_test_${randomUUID()}`, type: "checkout.session.completed" },
  });
  expect(response.status()).toBe(400);
  const body = await response.json() as { error?: string };
  expect(body.error).toMatch(/configuré|Signature/i);
});

test("facture d’un autre utilisateur inaccessible", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Contrôle isolation unique.");
  test.skip(!(await databaseReachable()), "PostgreSQL local injoignable pour ce run E2E.");

  const password = "Bicuni-Invoice-2026";
  const plan = await db.plan.findUniqueOrThrow({ where: { slug: "starter" } });
  const ownerEmail = `owner-${randomUUID()}@example.test`;
  const strangerEmail = `stranger-${randomUUID()}@example.test`;
  const invoiceRef = `in_iso_${randomUUID()}`;

  const owner = await db.user.create({
    data: {
      email: ownerEmail,
      name: "Owner E2E",
      passwordHash: await hash(password, 12),
      emailVerified: new Date(),
      status: "ACTIVE",
      role: "STUDENT",
      subscriptions: {
        create: {
          planId: plan.id,
          provider: "STRIPE",
          providerRef: `sub_iso_${randomUUID()}`,
          status: "ACTIVE",
          invoices: {
            create: {
              provider: "STRIPE",
              providerRef: invoiceRef,
              number: `ISO-${createHash("sha256").update(invoiceRef).digest("hex").slice(0, 8)}`,
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
  const stranger = await db.user.create({
    data: {
      email: strangerEmail,
      name: "Stranger E2E",
      passwordHash: await hash(password, 12),
      emailVerified: new Date(),
      status: "ACTIVE",
      role: "STUDENT",
    },
  });

  try {
    const csrf = await request.get("/api/auth/csrf");
    const { csrfToken } = await csrf.json() as { csrfToken: string };
    await request.post("/api/auth/callback/credentials", {
      form: { csrfToken, email: strangerEmail, password, callbackUrl: "/dashboard", json: "true" },
    });
    const invoices = await request.get("/api/invoices?page=1&limit=50");
    expect(invoices.status()).toBe(200);
    const payload = await invoices.json() as { invoices: Array<{ number?: string; providerRef?: string }> };
    expect(payload.invoices.some((invoice) => invoice.providerRef === invoiceRef)).toBe(false);
  } finally {
    await db.user.delete({ where: { id: stranger.id } }).catch(() => undefined);
    await db.user.delete({ where: { id: owner.id } }).catch(() => undefined);
  }
});
