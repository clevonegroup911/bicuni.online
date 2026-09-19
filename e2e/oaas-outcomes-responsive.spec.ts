/**
 * Smoke UI OaaS — catalogue et CTA aux trois viewports.
 * Ne mocke pas le parcours métier (voir oaas-academic-research.spec.ts).
 */
import { expect, test } from "@playwright/test";

const viewports = [
  { name: "1280", width: 1280, height: 800 },
  { name: "834", width: 834, height: 1194 },
  { name: "390", width: 390, height: 844 },
] as const;

for (const vp of viewports) {
  test(`catalogue /outcomes sans overflow (${vp.name})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/outcomes");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Décrire le résultat/i }).first()).toBeVisible();
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflow).toBe(false);
  });
}
